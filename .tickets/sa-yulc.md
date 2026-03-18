---
id: sa-yulc
status: open
deps: []
links: []
created: 2026-03-18T21:11:32Z
type: task
priority: 2
assignee: Jibles
---
# Write handover summary doc for Kev

Create a markdown file giving Kev a handover summary of the agentic project. Focus on:

## Key Areas to Cover

### Architecture Overview
- Monorepo: frontend (React/Vite in apps/agentic-chat) + backend (Bun/Hono in apps/agentic-server)
- Shared packages: caip, types, utils
- State management: Zustand stores (chatStore, orderStore, safeStore)

### Frontend Execution Flow
- Chat flow: Composer → ChatProvider (useChat from @ai-sdk/react) → POST /api/chat → streamed response
- Tool UI system: toolUIRegistry.tsx maps 26 tools to UI components
- Execution framework: useToolExecution hook manages step-by-step tx execution (quote → network → approval → swap)
- Execution.tsx compound component (Root/Stepper/Step) for visual progress
- useExecuteOnce() ensures single execution on mount
- State persisted to chatStore for page reload recovery

### System Prompts
- Location: apps/agentic-server/src/routes/chat.ts → buildSystemPrompt()
- Dynamic: adapts to wallet state, Safe deployment status, approved chains
- Sections: identity, tool routing table, tool UI rules, portfolio rules, USD conversion (critical), swap rules, CoW Protocol rules, Safe account rules, network capabilities
- Helper builders: buildConnectedWalletsPrompt(), buildSafeStatusPrompt()

### Backend Tool System
- 24 tools in src/tools/, each exports {description, inputSchema (Zod), execute}
- Categories: market data, swaps (Bebop/Relay), orders (CoW Protocol), wallet, portfolio, vault
- LLM: Claude Haiku 4.5 via Anthropic SDK

### Request/Response Flow
- Frontend injects wallet context (addresses, approved chains, Safe state, orders, known txs) into each /api/chat request
- Backend builds system prompt + tools + wallet context → streams to Claude → tool calls or text back
- Frontend renders tool UIs or markdown, executes transactions client-side with wallet signing

### Key Files
- ChatProvider.tsx, chat.ts (system prompt), toolUIRegistry.tsx, useToolExecution.ts, Execution.tsx, chatStore.ts
