---
id: sa-ptqt
status: closed
deps: []
links: []
created: 2026-03-06T02:27:41Z
type: chore
priority: 2
assignee: Jibles
---
# Consolidate tool-specific enumerations into central registries

## Objective

Reduce the number of files that must be touched when adding a new tool. Currently, adding a single tool requires 7-10 manual edits across 4+ files because tool names, output types, and metadata are enumerated independently in many places. This creates a high risk of an LLM (or human) forgetting one of these spots, causing silent bugs or type errors. The goal is: if we MUST enumerate every tool, do it exactly once in a central location, and derive everything else from that.

## Context & Findings

### Problem: Scattered tool enumerations

Adding a new tool currently requires updating ALL of these locations:

**Frontend (agentic-chat):**

1. `apps/agentic-chat/src/types/toolOutput.ts:27-54` — `ToolOutputMap` maps 23 tool names to output types. This is the closest thing to a central registry but it's type-only.
2. `apps/agentic-chat/src/components/toolUIRegistry.tsx:36-63` — `TOOL_UI_REGISTRY` duplicates the same 23 tool names mapping to React components. Must stay in sync with `ToolOutputMap`.
3. `apps/agentic-chat/src/stores/chatStore.ts:30-42` — `toolType` string literal union (12 entries for persistable tools).
4. `apps/agentic-chat/src/stores/chatStore.ts:47-58` — `toolOutput` type union (11 entries for persistable tool outputs).
5. `apps/agentic-chat/src/stores/chatStore.ts:206-213` — `hasTxHash` checks 7 different per-tool meta field names (`swapTxHash`, `sendTxHash`, `submitTxHash`, `cancelTxHash`, `depositTxHash`, `withdrawTxHash`, `approvalTxHash`). Should be a single `meta.txHash` field across all tools (with `approvalTxHash` kept as the only exception — it's a genuine second tx alongside the primary one).

**Server (agentic-server):**

6. `apps/agentic-server/src/routes/chat.ts:20-42` — 23 import statements, one per tool.
7. `apps/agentic-server/src/routes/chat.ts:114-167` — `buildTools()` manually wraps each tool with `wrapTool('toolName', tool, walletContext)` — the tool name string is duplicated as both the object key and the first argument.
8. `apps/agentic-server/src/index.ts:1-201` — ~200 lines of manual re-exports, 4-5 lines per tool.
9. `z.enum(['ethereum', 'gnosis', 'arbitrum'])` is copy-pasted in 7 files: `createLimitOrder.ts:21`, `createStopLoss.ts:42`, `cancelStopLoss.ts:9`, `createTwap.ts:58`, `cancelTwap.ts:9`, `vaultDeposit.ts:18`, `vaultWithdraw.ts:15`. Adding a new CoW-supported network means editing all 7.

**Activity system (lower priority, fewer tools affected):**

10. `apps/agentic-chat/src/lib/activityNormalizer.ts:12-22` — switch/case on `toolType` (3 cases).
11. `apps/agentic-chat/src/components/Portfolio/ActivityList.tsx:25` — hardcoded `.filter(tx => tx.toolType === 'swap' || tx.toolType === 'send' || tx.toolType === 'limit_order')`.
12. `apps/agentic-chat/src/components/Portfolio/ActivityRow/ActivityRow.tsx:20-34,59-61` — three separate enumerations: `ACTIVITY_ICONS` map, `formatActivityTitle` switch, and conditional JSX rendering.
13. `apps/agentic-chat/src/types/activity.ts:54-70` — discriminated union `ActivityItem = SwapActivityItem | SendActivityItem | LimitOrderActivityItem`.

### Rejected approach: full plugin/auto-discovery system
Over-engineered for the current tool count. The right fix is consolidating enumerations to single sources of truth, not building a plugin framework.

## Files

Modify:
- `apps/agentic-chat/src/types/toolOutput.ts` — already the best candidate for the frontend single source of truth; `ToolName` is already derived from `ToolOutputMap`
- `apps/agentic-chat/src/stores/chatStore.ts` — derive `toolType` and `toolOutput` unions from `ToolOutputMap` instead of maintaining separate lists; normalize `hasTxHash` to check single `meta.txHash` field
- `apps/agentic-chat/src/components/toolUIRegistry.tsx` — already typed against `ToolName`, just needs to stay as-is (this is an acceptable single enumeration point for UI components)
- `apps/agentic-server/src/routes/chat.ts` — refactor `buildTools()` to iterate over a tools array/registry rather than manual object literal
- `apps/agentic-server/src/index.ts` — consider barrel exports from tool directories
- 7 CoW tool files — extract shared `cowSupportedNetworkSchema` to a single constant

Reference:
- `apps/agentic-chat/src/lib/activityNormalizer.ts` — activity switch/case (lower priority, only 3 tools)
- `apps/agentic-chat/src/components/Portfolio/ActivityRow/ActivityRow.tsx` — activity rendering (lower priority)
- `apps/agentic-chat/src/types/activity.ts` — activity types (lower priority)

## Acceptance Criteria

- [ ] `ToolOutputMap` in `toolOutput.ts` is the single source of truth for tool name → output type on the frontend
- [ ] `PersistedToolState.toolType` union in `chatStore.ts` is derived from a central type (not a separate hand-maintained list)
- [ ] `PersistedToolState.toolOutput` union in `chatStore.ts` is derived from a central type (not a separate hand-maintained list)
- [ ] All tools use a single `meta.txHash` field instead of per-tool variants (`swapTxHash`, `sendTxHash`, etc.); `approvalTxHash` remains as the only exception
- [ ] `hasTxHash` check in `chatStore.ts:206-213` is reduced to `existing.meta.txHash`
- [ ] CoW-supported network enum (`['ethereum', 'gnosis', 'arbitrum']`) is defined once and imported by all 7 tool schemas
- [ ] `buildTools()` in `chat.ts` no longer requires duplicating the tool name as both the key and the `wrapTool()` first argument (e.g., iterate over an array of tool definitions)
- [ ] Adding a new non-activity tool requires updating at most 3 files: the tool implementation, the central registry/map, and the UI component + registry entry
- [ ] All execution hooks that set tool-specific txHash meta fields (e.g., `useSwapExecution`, `useSendExecution`, etc.) are updated to use `meta.txHash` instead
- [ ] Existing persisted data migration: store version bump handles reading old `swapTxHash`/`sendTxHash`/etc. fields from localStorage
- [ ] Lint and type-check pass (`pnpm lint && pnpm typecheck`)

## Gotchas

- The txHash rename requires a store migration (bump `STORE_VERSION`) to map old per-tool hash fields to the new `meta.txHash` — otherwise users with existing localStorage lose their terminal-state protection and activity history
- `toolUIRegistry.tsx` must enumerate tool→component mappings — that's fine, it's a natural single registry point. The problem is when the SAME list is duplicated elsewhere
- `getAllowanceTool` in `buildTools()` has custom address resolution logic (lines 152-165) — any registry pattern must accommodate one-off overrides
- `activityNormalizer.ts` and `ActivityRow.tsx` are lower priority — the activity system only covers 3 tool types and has inherently different rendering per type, so some enumeration there is acceptable
- The `index.ts` barrel exports are consumed by `agentic-chat` — changes there must not break the import contract
