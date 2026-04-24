# webhook-server: A2A Push Notifications

This module provides a WebSocket-based CAP server for handling A2A PushNotifications, enabling real-time status updates from the agent to be visualized in a React UI.

## 1) Overview

The webhook-server consists of three components:

| Component | Description |
| --- | --- |
| **`api/`** | CAP backend exposing `/webhook` (POST) and `/events` (SSE) endpoints |
| **`ui/sse-client/`** | React frontend that connects to SSE and displays live events |
| **`router/`** | SAP Approuter for unified UI/API access with XSUAA authentication |

## 2) Prerequisites

- Node.js (v18+)
- npm

## 3) Local Development

Run API, UI, and Approuter together:

```bash
cd webhook-server
npm run watch
```

This starts in parallel:
- **CAP API** on port 4006 (`watch:api`)
- **React UI** via Vite dev server on port 5173 (`watch:ui`)
- **Approuter** on port 5000 (`router`)

Open http://localhost:5000 to access the application (Approuter proxies to API and UI).

## 4) API Endpoints

| Endpoint | Method | Auth | Description |
| --- | --- | --- | --- |
| `/webhook` | POST | Bearer/Basic | Receives webhook payloads and broadcasts to SSE clients |
| `/events` | GET | XSUAA (via Router) | Server-Sent Events stream for real-time updates |
| `/health` | GET | XSUAA | Health check endpoint |

### Webhook Authentication

The `/webhook` endpoint supports two authentication methods:

**Bearer Token:**
```bash
export WEBHOOK_BEARER_TOKEN=your-secret-token
```

**Basic Auth:**
```bash
export WEBHOOK_BASIC_USER=username
export WEBHOOK_BASIC_PASS=password
```

Multiple bearer tokens can be configured:
```bash
export WEBHOOK_BEARER_TOKENS=token1,token2,token3
```

## 5) Testing Webhooks

### Send a Test Event

```bash
curl -X POST http://localhost:4006/webhook \
  -H 'Authorization: Bearer local-bearer-token' \
  -H 'Content-Type: application/json' \
  -d '{"type":"status-update","payload":{"taskId":"123","status":"working"}}'
```

### View Events in UI

Open http://localhost:5173 (or http://localhost:5000 with router) to see incoming events displayed in real-time.

## 6) Integration with A2A Agent

To receive push notifications from the A2A Agent:

### Step 1: Configure Webhook Authentication

Set the bearer token for the webhook server:
```bash
export WEBHOOK_BEARER_TOKEN=eyabcdefg123457
```

### Step 2: Configure Allowed URLs in the Agent

Add the webhook URL to `ALLOWED_PUSH_NOTIFICATION_URLS` in `a2a-agent/pro-code-agent/agent/.cdsrc.json`:
```json
{
  "webhook": {
    "ALLOWED_PUSH_NOTIFICATION_URLS": ["http://localhost:4006/*"]
  }
}
```

### Step 3: Start Both Services

```bash
# Terminal 1: Start the A2A Agent (Port 4004)
cd a2a-agent/pro-code-agent/agent
npm run watch

# Terminal 2: Start the Webhook Server (API + UI + Router)
cd webhook-server
export WEBHOOK_BEARER_TOKEN=eyabcdefg123457
npm run watch
```

### Step 4: Trigger the Agent with Push Notifications

Send a request to the A2A Agent with `pushNotificationConfig` to receive status updates via webhook:

```bash
curl -X POST http://localhost:4004/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "message/stream",
    "params": {
      "message": {
        "role": "user",
        "parts": [
          {
            "kind": "text",
            "text": "Optimize the latest order from customer Altinova."
          }
        ],
        "messageId": "1"
      },
      "configuration": {
        "pushNotificationConfig": {
          "url": "http://localhost:4006/webhook",
          "authentication": {
            "schemes": ["Bearer"],
            "credentials": "eyabcdefg123457"
          }
        }
      }
    }
  }'
```


### Step 5: View Status Updates

Open http://localhost:5173 to see the agent's status updates (e.g., "working", "completed") appear in real-time as the agent processes the request.

## 7) Project Structure

```
webhook-server/
├── api/                    # CAP Backend
│   ├── server.ts           # Main server with webhook + SSE logic
│   ├── srv/
│   │   ├── webhook.cds     # CAP service definition
│   │   └── server.ts       # (deprecated, logic moved to api/server.ts)
│   ├── xs-security.json    # XSUAA security configuration
│   └── package.json
├── ui/sse-client/          # React Frontend
│   ├── src/
│   │   ├── App.tsx
│   │   └── components/
│   │       └── LiveEventsView.tsx  # Main SSE visualization component
│   └── package.json
├── router/                 # SAP Approuter
│   ├── xs-app.json         # Production route configuration (XSUAA)
│   ├── dev/                # Local development configuration
│   │   ├── xs-app.json     # Dev routes (no auth)
│   │   └── default-env.json
│   └── package.json
├── mta.yaml                # MTA deployment descriptor
└── package.json            # Workspace scripts
```

## 8) Deployment to Cloud Foundry

### Prerequisites

- [MBT (MTA Build Tool)](https://sap.github.io/cloud-mta-build-tool/) installed
- [CF CLI](https://docs.cloudfoundry.org/cf-cli/install-go-cli.html) installed and logged in
- XSUAA service available in your subaccount

### Build & Deploy

```bash
cd webhook-server
npm run deploy
```

This runs `mbt build` and `cf deploy` in sequence.

Alternatively, build and deploy separately:

```bash
# Build only
npm run build

# Deploy (requires prior build)
cf deploy mta_archives/webhook-server_1.0.0.mtar
```

### Required Services

| Service | Plan | Description |
| --- | --- | --- |
| `xsuaa` | application | Authentication for UI and API |

### Post-Deployment Configuration

After deployment, configure the webhook authentication via environment variables:

```bash
cf set-env webhook-cap-srv WEBHOOK_BEARER_TOKEN your-production-token
cf restage webhook-cap-srv
```

## 9) Route Configuration

### Production (`router/xs-app.json`)

| Route | Target | Auth |
| --- | --- | --- |
| `/api/webhook` | `/webhook` on API | None (uses Bearer/Basic) |
| `/api/*` | API backend | XSUAA |
| `/*` | Static UI files | XSUAA |

### Local Development (`router/dev/xs-app.json`)

| Route | Target | Auth |
| --- | --- | --- |
| `/api/*` | API backend | None |
| `/*` | UI (Vite dev server) | None |

This allows:
- **Production:** XSUAA authentication for UI and SSE, Bearer/Basic for webhook
- **Local Development:** No authentication required, Approuter proxies to API (port 4006) and UI (port 5173)

## 10) Troubleshooting

### SSE Connection Issues

If the UI shows "Connecting" but never connects:
- Verify the API is running on the expected port
- Check browser console for CORS errors
- Ensure `VITE_SERVER2_PORT` matches the API port

### Webhook Returns 401

- Verify `WEBHOOK_BEARER_TOKEN` or `WEBHOOK_BASIC_USER`/`WEBHOOK_BASIC_PASS` are set
- Check the Authorization header format:
  - Bearer: `Authorization: Bearer your-token`
  - Basic: `Authorization: Basic base64(user:pass)`

### Events Not Appearing in UI

- Confirm the webhook POST returns 200
- Check API logs for "Webhook received" messages
- Verify SSE connection is established (status badge shows "Connected")