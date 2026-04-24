import { v4 as uuidv4 } from "uuid";

// CAP
import cds from "@sap/cds";

// A2A
import { Task, TaskStatusUpdateEvent, Message } from "@a2a-js/sdk";
import { AgentExecutor, RequestContext, ExecutionEventBus } from "@a2a-js/sdk/server";

// LANGCHAIN / LANGGRAPH WITH GENERATIVE AI HUB, SAP AI CORE
import { OrchestrationClient } from "@sap-ai-sdk/langchain";
import { END, START, Command, MemorySaver, MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import type { BaseMessageLike } from "@langchain/core/messages";

import { a2aMessagesToLangChain } from "./utils/a2aToLangchain";
import { tools as agentTools } from "./tools/tools";
import { getSystemPrompt } from "./utils/prompts";
import { createInterruptUpdate, createMessage, createMessageUpdate, createNewTask } from "./utils/a2a-operations";

const logger = cds.log("pro-code-agent", { label: "Pro-code Agent" });

const contexts = new Map<string, Message[]>();

type AgentGraphState = {
    messages: BaseMessageLike[];
};

function createAgentNode(modelWithTools: ReturnType<OrchestrationClient["bindTools"]>) {
    return async (state: AgentGraphState) => {
        const response = await modelWithTools.invoke([
            { role: "system", content: getSystemPrompt() },
            ...state.messages
        ]);
        return { messages: [response] };
    };
}

export class LangGraphAgentExecutor implements AgentExecutor {
    private app: any;

    constructor() {
        const model = new OrchestrationClient({
            promptTemplating: {
                model: {
                    name: "gpt-4.1"
                }
            }
        });
        const modelWithTools = model.bindTools(agentTools);
        const toolNode = new ToolNode(agentTools);
        const stateGraph = this.instantiateStateGraph(toolNode, createAgentNode(modelWithTools));
        const memorySaver = new MemorySaver();
        this.app = stateGraph.compile({ checkpointer: memorySaver });
    }

    private instantiateStateGraph = (
        toolNode: ToolNode,
        agentNode: (state: AgentGraphState) => Promise<{ messages: unknown[] }>
    ) => {
        return new StateGraph(MessagesAnnotation)
            .addNode("agent", agentNode)
            .addNode("tools", toolNode)
            .addEdge(START, "agent")
            .addConditionalEdges("agent", this.shouldContinue, ["tools", END])
            .addEdge("tools", "agent")
    };

    

    private validateExtensions(extensions: string[] | undefined) {
        const knownExtensions = ["https://github.com/SAP-samples/btp-joule-a2a-pro-code-agent/a2a-agent/extensions/mock-response/v1"]
        const validExtensions = extensions?.filter((ext) => knownExtensions.includes(ext)) || [];

        return validExtensions;
    }

    private mockResponse(eventBus: ExecutionEventBus): void {
        eventBus.publish({
            kind: "message",
            role: "agent",
            messageId: uuidv4(),
            parts: [{ kind: "text", text: "This is a mocked response from the Sales Optimization Agent." }],
        })
    }


    async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
        const extensions = this.validateExtensions(requestContext.userMessage.extensions);
        logger.log(requestContext)

        if(extensions.includes("https://github.com/SAP-samples/btp-joule-a2a-pro-code-agent/a2a-agent/extensions/mock-response/v1")) {
            this.mockResponse(eventBus)
            return
        }

        const userMessage = requestContext.userMessage;
        const existingTask = requestContext.task;

        if(userMessage.parts.find((part) => part.kind !== "text")) {
            logger.log("Found parts in message content other than kind text, but only text is supported", userMessage.parts);
        }

        const taskId = existingTask?.id || requestContext.taskId || uuidv4();
        const contextId = userMessage.contextId || existingTask?.contextId || uuidv4();

        // 1. Publish initial Task event if it's a new task
        if (!existingTask) {
            logger.log("Publishing initial task event", taskId);
            const initialTask: Task = createNewTask(userMessage, {taskId, contextId})
            eventBus.publish(initialTask);
        }

        // 2. Publish "working" status update
        const workingStatusUpdate: TaskStatusUpdateEvent = createMessageUpdate("Processing your request...", {taskId, contextId, final: false});
        eventBus.publish(workingStatusUpdate);

        const historyForAgent = contexts.get(contextId) || [];

        if (!historyForAgent.find((m) => m.messageId === userMessage.messageId)) {
            historyForAgent.push(userMessage);
        }
        contexts.set(contextId, historyForAgent);

        // Convert A2A messages to LangChain format (via helper)
        const messages = a2aMessagesToLangChain(historyForAgent);

        let res;

        const textParts = userMessage.parts.filter((part) => part.kind == "text");
        const messageText = textParts.map((part) => part.text).join(" ");

        // If resuming a task
        if (requestContext.task) {
            logger.log("resuming task", requestContext.taskId)
            res = await this.app.stream(
                new Command({ resume: messageText }),
                { configurable: { thread_id: requestContext.taskId } }
            )
        } else {
            res = await this.app.stream(
                { messages },
                {
                    configurable: { thread_id: taskId }
                }
            );
        }

        let finalRes = "";
        for await (const chunk of res) {
            if(!("__interrupt__" in chunk)) {
                //Concatenating final response
                const agentMessages = chunk.agent?.messages;
                if(Array.isArray(agentMessages)) {
                    const agentMessage = agentMessages[agentMessages.length -1];
                    if(agentMessage instanceof Object && "content" in agentMessage) {
                        finalRes += agentMessage.content;
                    }
                }
                continue
            }
            logger.log("publishing interrupt")
            type InterruptChunk = {
                __interrupt__: Array<{
                    value: any;
                }>;
            };
            const interruptValue = (chunk as InterruptChunk).__interrupt__[0].value
            const interruptUpdate: TaskStatusUpdateEvent = createInterruptUpdate(interruptValue, {taskId, contextId});
            eventBus.publish(interruptUpdate);
            eventBus.finished();
            return
        }

        const finalMessage: Message = createMessage(finalRes, {taskId, contextId});

        historyForAgent.push(finalMessage);
        contexts.set(contextId, historyForAgent);

        const finalUpdate: TaskStatusUpdateEvent = createMessageUpdate(finalMessage, {taskId, contextId, final: true});

        eventBus.publish(finalUpdate);
        eventBus.finished();

        logger.log(`[LangGraphAgentExecutor] Task ${taskId} finished with state: ${"completed"}`);
    }

    public cancelTask = async (taskId: string, eventBus: ExecutionEventBus): Promise<void> => {};

    private shouldContinue(state: AgentGraphState) {
        const messages = state.messages;
        const lastMessage = messages[messages.length - 1] as { tool_calls?: unknown[] } | undefined;

        if (lastMessage?.tool_calls?.length) {
            console.log("Invoking tools!");
            return "tools";
        }
        
        return END;
    }
}
