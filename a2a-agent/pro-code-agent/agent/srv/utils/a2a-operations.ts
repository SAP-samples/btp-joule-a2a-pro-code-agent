import { Message, Task, TaskStatusUpdateEvent } from "@a2a-js/sdk";
import { v4 as uuidv4 } from "uuid";

function createNewTask(message: Message, options: {taskId: string, contextId: string}): Task {
    const { taskId, contextId } = options;
    return (
        {
            kind: "task",
            id: taskId,
            contextId: contextId,
            status: {
                state: "submitted",
                timestamp: new Date().toISOString()
            },
            history: [message], // Start history with the current user message
            metadata: message.metadata // Carry over metadata from message if any
        }
    );
}

function createMessageUpdate(message: string | Message, options: {taskId: string, contextId: string, final: boolean}): TaskStatusUpdateEvent {
    const { taskId, contextId, final } = options;
    const statusMessage = typeof message === "string" ? (
        {
            kind: "message",
            messageId: uuidv4(),
            role: "agent",
            parts: [{ kind: "text", text: message }],
            taskId: taskId,
            contextId: contextId
        } as Message): message;
    return (
        {
            kind: "status-update",
            taskId: taskId,
            contextId: contextId,
            status: {
                state: final?"completed":"working",
                message: statusMessage,
                timestamp: new Date().toISOString()
            },
            final: false
        }
    );
}

function createInterruptUpdate(message: string, options: {taskId: string, contextId: string}): TaskStatusUpdateEvent {
    const { taskId, contextId } = options;
    return (
        {
            kind: "status-update",
            taskId: taskId,
            contextId: contextId,
            status: {
                state: "input-required",
                message: {
                    kind: "message",
                    role: "agent",
                    messageId: uuidv4(),
                    parts: [{ kind: "text", text: message }],
                    taskId: taskId,
                    contextId: contextId
                },
                timestamp: new Date().toISOString()
            },
            final: true
        }
    );
}

function createMessage(message: string, options: {taskId: string, contextId: string}): Message {
    const { taskId, contextId } = options;
    return (
        {
            kind: "message",
            messageId: uuidv4(),
            role: "agent",
            parts: [{ kind: "text", text: message }],
            // Associate the response with the incoming request's context.
            taskId: taskId,
            contextId: contextId
        }
    );
}

export { createNewTask, createMessageUpdate, createInterruptUpdate, createMessage };