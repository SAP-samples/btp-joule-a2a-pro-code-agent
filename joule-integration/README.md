# Joule Integration

This directory contains the configuration files and Digital Agent Artifact (DAAR) package required to integrate the Sales Optimization Agent with Joule using the A2A (Agent-to-Agent) Protocol.

## Overview

The integration enables Joule to act as a client that delegates sales inquiry optimization tasks to the Sales Optimization Agent. This follows SAP's "Bring Your Own Agent" approach for code-based agents, allowing custom-built agents to be accessible through Joule's conversational interface.

## Structure

```
joule-integration/
├── da.sapdas.yaml                          # Digital Agent definition (root configuration)
└── sales-optimization-agent/
    ├── capability.sapdas.yaml              # Capability metadata and system aliases
    ├── capability_context.yaml             # Context variables (contextId, taskId)
    ├── functions/
    │   └── call_agent.yaml                 # Function implementing A2A agent-request action
    └── scenarios/
        └── invoke_agent.yaml               # Scenario triggering the agent invocation
```

## Key Components

### Joule - Digital Agent Definition ([da.sapdas.yaml](./da.sapdas.yaml))

Defines the root configuration with capability reference to `sales-optimization-agent/`. The agent uses A2A protocol for remote agent invocation without native agenticness.

### Capability ([sales-optimization-agent/capability.sapdas.yaml](./sales-optimization-agent/capability.sapdas.yaml))

- **Name**: `swiss_knife_sales_optimization_agent_a2a`
- **Display Name**: "Sales Optimization Agent A2A Connector"
- **System Alias**: `SalesOptimiztionAgent` → Destination `SALES_OPTIMIZATION_AGENT_A2A`

### Function ([sales-optimization-agent/functions/call_agent.yaml](./sales-optimization-agent/functions/call_agent.yaml))

Implements A2A integration using `agent-request` action type with `agent_type: remote`, sending `contextId` and `taskId` for conversation continuity.

### Scenario ([sales-optimization-agent/scenarios/invoke_agent.yaml](./sales-optimization-agent/scenarios/invoke_agent.yaml))

Triggers on sales inquiry optimization requests (e.g., "Optimize the latest sales inquiry from customer Altinova").

## Deployment with Joule CLI

### Prerequisites

1. **Install Joule CLI**: Follow [installation instructions](https://help.sap.com/docs/joule/joule-development-guide-ba88d1ec6a1b442098863d577c19b0c0/install-and-update-joule-studio-cli)

2. **Configure Destination**: Create destination `SALES_OPTIMIZATION_AGENT_A2A` in SAP BTP Cockpit pointing to your deployed agent

3. **Login to Joule**: 
   ```bash
   joule login
   ```
   See [login documentation](https://help.sap.com/docs/joule/joule-development-guide-ba88d1ec6a1b442098863d577c19b0c0/joule-login)

### Deploy Steps

Navigate to the capability directory and compile:
```bash
cd joule-integration/sales-optimization-agent
joule compile
```

Deploy the compiled artifact (replace `NAME` with your desired agent name):
```bash
joule deploy -c -n NAME
```

Launch the agent in Joule:
```bash
joule launch NAME
```

**CLI References**:
- [joule compile](https://help.sap.com/docs/joule/joule-development-guide-ba88d1ec6a1b442098863d577c19b0c0/joule-compile) - Compile capability into DAAR
- [joule deploy](https://help.sap.com/docs/joule/joule-development-guide-ba88d1ec6a1b442098863d577c19b0c0/joule-deploy) - Deploy to Joule tenant
- [joule launch](https://help.sap.com/docs/joule/joule-development-guide-ba88d1ec6a1b442098863d577c19b0c0/joule-launch) - Open agent in Joule interface

### Test the Integration

Once deployed, open Joule and try:
```
"Optimize the latest sales inquiry from customer Altinova"
```

The agent will be invoked via A2A protocol and return optimized quotation recommendations.

## References

- [A2A Protocol Specification](https://a2a-protocol.org/latest/)
- [SAP Joule Development Guide - Code-Based Agents](https://help.sap.com/docs/joule/joule-development-guide-ba88d1ec6a1b442098863d577c19b0c0/code-based-agents-bring-your-own-agent)
- [SAP Architecture Center - Integrating AI Agents with Joule](https://architecture.learning.sap.com/docs/ref-arch/ca1d2a3e/4)
- [Agent Implementation](../a2a-agent/README.md)
