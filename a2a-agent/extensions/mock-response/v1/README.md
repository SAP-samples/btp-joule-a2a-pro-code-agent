# Mock Response Extension (v1)

URI: `https://github.com/SAP-samples/btp-joule-a2a-pro-code-agent/a2a-agent/extensions/mock-response/v1`

## Purpose
This extension is used for testing A2A communication and extension activation without invoking any LLM or backend business logic.

When the extension is activated, the agent immediately returns a static mocked response message.

## Behavior
On successful activation, the extension publishes the following agent message to the event bus:

```ts
eventBus.publish({
    kind: "message",
    role: "agent",
    messageId: uuidv4(),
    parts: [
        {
            kind: "text",
            text: "This is a mocked response from the Sales Optimization Agent."
        }
    ],
})