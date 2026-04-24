import cds from "@sap/cds";
import { Express } from "express";
import { AGENT_CARD_PATH } from "@a2a-js/sdk";
import type { AgentCard } from "@a2a-js/sdk";
import {
    AgentExecutor,
    InMemoryTaskStore,
    DefaultPushNotificationSender,
    InMemoryPushNotificationStore
} from "@a2a-js/sdk/server";
import { agentCardHandler, jsonRpcHandler, UserBuilder } from "@a2a-js/sdk/server/express";

import { LangGraphAgentExecutor } from "./agent-executor";
import { getA2aServerUrl } from "./utils/helpers";
import { CustomRequestHandler } from "./CustomRequestHandler";

// @ts-ignore
cds.on("bootstrap", (app: Express) => {
    const taskStore = new InMemoryTaskStore();
    const agentExecutor: AgentExecutor = new LangGraphAgentExecutor();
    const pushStore = new InMemoryPushNotificationStore();
    const pushSender = new DefaultPushNotificationSender(pushStore);
    const requestHandler = new CustomRequestHandler(
        agentCard,
        taskStore,
        agentExecutor,
        undefined,
        pushStore,
        pushSender,
        extendedAgentCard
    );

    app.use(`/${AGENT_CARD_PATH}`, agentCardHandler({ agentCardProvider: requestHandler }));
    // we might want to change the path to /a2a/jsonrpc like in their example
    // to make clear we only support JSON-RPC as transport right now
    app.use("/", jsonRpcHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }));
});

const a2aServerUrl = getA2aServerUrl();

const agentCard: AgentCard = {
    name: "Sales Optimization Agent",
    description:
        "Optimizes order inquiries to maximize sales conversion probability, financial health and customer lifetime value. Based on these recommendations for optimization, it creates sales quotations.",
    url: a2aServerUrl,
    provider: { organization: "BestRun", url: "https://www.sap.com" },
    version: "0.0.1",
    capabilities: {
        streaming: true,
        pushNotifications: true,
        stateTransitionHistory: false
    },
    defaultInputModes: ["text"],
    defaultOutputModes: ["text", "json"],
    skills: [
        {
            id: "sales-quotation-optimization",
            name: "Sales Quotation Optimization",
            description:
                "Analyzes sales quotations and recommends specific adjustments to increase sales conversion probability and improve financial health.",
            tags: [
                "sales quotation optimization",
                "sales quotation analysis",
                "financial health",
                "conversion rate",
                "sales optimization"
            ],
            examples: ["Optimize the latest order inquiry."],
            outputModes: ["text/plain", "application/json"]
        },
        {
            id: "sales-quotation-creation",
            name: "Sales Quotation Creation",
            description:
                "Creates sales quotations based on optimized sales quotations, incorporating recommended adjustments to enhance conversion rates and financial health.",
            tags: ["sales quotation creation", "sales optimization", "financial health", "conversion rate"],
            examples: ["Create a sales quotation out of the latest order inquiry."],
            outputModes: ["text/plain", "application/json"]
        }
    ],
    supportsAuthenticatedExtendedCard: true,
    protocolVersion: "0.3.0"
};

const extendedAgentCard: AgentCard = {
    ...agentCard,
    capabilities: {
        ...agentCard.capabilities,
        extensions: [
            {
                uri: "https://github.com/SAP-samples/btp-joule-a2a-pro-code-agent/a2a-agent/extensions/mock-response/v1",
                description: "Returns mocked responses when activated via transport header.",
                required: false,
                params: { mode: "opt-in" }
            }
        ]
    }
};
