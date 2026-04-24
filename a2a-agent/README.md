# a2a-agent: Local Setup

This guide walks you through a full local setup of the A2A Agent.

## 1) Prerequisites
- Node.js for local development
- Recommended: Node Version Manager (nvm)

## 2) Clone the Repository
```bash
git clone https://github.com/SAP-samples/btp-joule-a2a-pro-code-agent
cd btp-joule-a2a-pro-code-agent
```

## 3) Install Dependencies
Install required packages.
```bash
cd a2a-agent/pro-code-agent/agent
npm install
```

## 4) Start the Agent (Port 4004 locally)
Run the CAP service hosting the A2A endpoints.
```bash
cd a2a-agent/pro-code-agent/agent
npm run watch
```
Verify the Agent Card (GET):
- http://localhost:4004/.well-known/agent-card.json

## 5) Test Requests (locally)
JSON‑RPC against the Agent:
- URL: http://localhost:4004/
- Headers: `Content-Type: application/json`
- Optional for mock: `X-A2A-Extensions: https://github.com/SAP-samples/btp-joule-a2a-pro-code-agent/a2a-agent/extensions/mock-response/v1`
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "message/send",
  "params": {
    "message": {
      "kind": "message",
      "role": "user",
      "messageId": "msg-1",
      "parts": [
        { "kind": "text", "text": "Optimize the latest order from customer Altinova." }
      ]
    },
    "configuration": { "blocking": true }
  }
}
```

## 6) Multi‑Turn Conversations and `taskId`
Flow:
  1) Send the first message without `taskId`.
  2) Extract the returned task ID from the response.
  3) Include that `taskId` in follow-up messages while the server process remains running.

## 7) Push Notifications (Webhook + SSE UI)

- Start the Webhook API (Port 4006) in new terminal window:
  ```bash
  cd webhook-server/api
  export WEBHOOK_BEARER_TOKEN=local-bearer-token
  PORT=4006 cds run
  ```

- Start the SSE UI (Port 5173) in new terminal window:
  ```bash
  cd webhook-server/ui/sse-client
  export VITE_SERVER2_PORT=4006
  npm install # (only at first time)
  npm run dev
  ```

  Open: http://localhost:5173 (connects to `http://localhost:4006/events` and displays live events)

- Post Events (in new terminal window):
  ```bash
  curl -X POST http://localhost:4006/webhook -H 'Authorization: Bearer local-bearer-token' -H 'Content-Type: application/json' -d '{"type":"status-update","payload":{"taskId":"123","status":"working"}}'
  ```

- Allow webhook URLs in the Agent:
  Ensure `ALLOWED_PUSH_NOTIFICATION_URLS` in `a2a-agent/pro-code-agent/agent/.cdsrc.json` includes `"http://localhost:4006/*"`.

## 8) Agent Structure

High-level flow:
1) A2A request
2) Express routes in `srv/server.ts`
3) `srv/CustomRequestHandler.ts` (validation)
4) `srv/agent-executor.ts` (reasoning + tools)
5) A2A response

Server layer (`srv/`):
- `server.ts`: Bootstraps CAP, mounts A2A Express endpoints, and serves the Agent Card at `/.well-known/agent-card.json`.
- `CustomRequestHandler.ts`: Validates `configuration.pushNotificationConfig.url` for allowed patterns, then delegates to the default A2A handling.

Executor & orchestration:
- `agent-executor.ts`: Implements the LangGraph-based agent. It builds state, applies prompts, calls registered tools, and emits status updates and a final agent message. Tasks are live in-memory where the first message creates a task and returns its `taskId` for follow-ups.

Tools:
- `tools/tools.ts`: Central registry for tools the agent can call (name, description, input, implementation). Add new tools here and wire them into the executor.

Utilities (`srv/utils/`):
- `helpers.ts`: Reads runtime config (e.g., `ALLOWED_PUSH_NOTIFICATION_URLS`) and server URL helpers.
- `prompts.ts`: System/assistant prompt templates.
- `types.ts`: Shared TypeScript types for agent messages/config.

Configuration & build:
- `.cdsrc.json`: CAP runtime config, including `ALLOWED_PUSH_NOTIFICATION_URLS` (whitelist for push destinations).
- `package.json`, `tsconfig.json`, `eslint.config.mjs`: Scripts, TypeScript, and linting setup for local dev.
- `mta.yaml`, `xs-security.json`: Deployment/security descriptors for SAP landscapes.

Testing:
- Use the curl/Bruno examples in this guide to send JSON‑RPC requests to the agent.
- For integration testing, see the [webhook-server](../webhook-server/README.md) for push notification testing.

Webhook + UI (separate module):
- `webhook-server/api`: CAP API exposing `/webhook` (POST) and `/events` (SSE) to receive and view push notifications.
- `webhook-server/ui/sse-client`: React app that listens to SSE and visualizes events.
- `webhook-server/router`: Approuter (router mode) for unified UI/API on port 5000 (Node 20/22).

Extend the agent:
- Add a tool: implement it in `srv/tools/tools.ts` and ensure the executor can invoke it.
- Enable push: whitelist your destination in `.cdsrc.json` and set `pushNotificationConfig` in the client.
- Add data models: define entities in `service.cds` and logic in `service.ts`, consume via `@cds-models/*` in tools/executor.

## 9) Deployment to Cloud Foundry

### Prerequisites
- [MBT (MTA Build Tool)](https://sap.github.io/cloud-mta-build-tool/) installed
- [CF CLI](https://docs.cloudfoundry.org/cf-cli/install-go-cli.html) installed and logged in
- Required BTP services available in your subaccount (see below)

### Build the MTA Archive
```bash
cd a2a-agent/pro-code-agent/agent
mbt build
```
This creates an `.mtar` file in `mta_archives/`.

### Deploy to Cloud Foundry
```bash
cf deploy mta_archives/code-based-agent_1.0.0.mtar
```

### Required Services
The deployment requires the following services (defined in `mta.yaml`):

| Service | Plan | Description |
| --- | --- | --- |
| `aicore` | extended | SAP AI Core / Generative AI Hub |
| `destination` | lite | Destination Service |
| `application-logs` | lite | Application Logging Service |

These services must exist in your Cloud Foundry space before deployment. You can create them manually or use the [Terraform configuration](../terraform/README.md) for automated infrastructure setup.

### Verify Deployment
After deployment, verify the Agent Card is accessible:
```
https://<your-cf-app-url>/.well-known/agent-card.json
```

