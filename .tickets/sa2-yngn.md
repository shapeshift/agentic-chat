---
id: sa2-yngn
status: open
deps: []
links: []
created: 2026-03-10T02:54:57Z
type: feature
priority: 2
assignee: Jibles
---
# Add progress substatus text to tool execution steps

## Objective

Tool execution steps that involve on-chain transactions (swap, send, limit order, TWAP, stop-loss, vault deposit/withdraw, cancel orders) currently show a static label while in-progress. Users have no visibility into _what phase_ is happening within a step — e.g., whether we're submitting a transaction, waiting for a wallet signature, or confirming on-chain. Add dynamic substatus text (grey subtext below each step label) that updates as the step progresses through its phases.

## User Story

Users executing on-chain transactions want real-time feedback on what's happening during each step so they know the system is working and can anticipate what's next (e.g., "Submitting transaction..." → "Confirming on-chain...").

## Design Constraints

- Must use the existing `subtitle` prop on `Execution.Step` — the UI rendering is already implemented in `TxStepCard.Step` (shown only during `IN_PROGRESS` status as grey `text-xs text-muted-foreground`)
- Substatus text is transient — it should NOT be persisted to localStorage. When rehydrating from persisted state, steps show labels only (no stale substatus)
- Must not add new state fields to `ToolExecutionState` that get persisted — use a separate transient mechanism

## Context & Findings

- **`subtitle` prop already works end-to-end**: `Execution.Step` accepts `subtitle?: string`, passes it to `TxStepCard.Step`, which renders it below the label only when `status === StepStatus.IN_PROGRESS`. Zero UI work needed.
- **No tool currently passes `subtitle`**: Every `<Execution.Step>` across all 12+ tool UIs omits the subtitle prop entirely.
- **Mechanism needed**: The execution hooks (e.g., `useSwapExecution`, `useSendExecution`) run async logic and need a way to set/clear transient substatus text per step. Options:
  - (A) Add a `substatus` field to `ToolExecutionState` and strip it before persisting — simplest, keeps everything in one state tree
  - (B) Use a separate `useRef` or lightweight Zustand slice for transient substatus keyed by `toolCallId + stepIndex` — cleaner separation but more wiring
  - (C) Store substatus in `meta` with a convention — no new fields, but pollutes meta and gets persisted
  - Option A is recommended for simplicity. `advanceStep` and `skipStep` in `useToolExecution.ts` should auto-clear substatus.
- **Tool UIs read state reactively**: Since `Execution.Step` reads from `ExecutionCtx` which gets `state` from the Zustand store, any state update triggers re-render. The `subtitle` prop just needs to be wired from `state.substatus` (or similar) in the `Step` component.

## Files

**Core changes:**
- `apps/agentic-chat/src/lib/executionState.ts` — add transient `substatus?: string` field to `ToolExecutionState`
- `apps/agentic-chat/src/hooks/useToolExecution.ts` — add `setSubstatus(text?: string)` to `ExecutionContext`, auto-clear on `advanceStep`/`skipStep`
- `apps/agentic-chat/src/components/Execution.tsx` — read `state.substatus` and pass as `subtitle` to `TxStepCard.Step`
- `apps/agentic-chat/src/stores/chatStore.ts` — strip `substatus` in `persistTransaction` so it never hits localStorage

**Tool execution hooks to update (add setSubstatus calls):**
- `apps/agentic-chat/src/components/tools/InitiateSwapUI.tsx` (or its execution hook)
- `apps/agentic-chat/src/components/tools/SendUI.tsx`
- `apps/agentic-chat/src/components/tools/LimitOrderUI.tsx`
- `apps/agentic-chat/src/components/tools/TwapUI.tsx`
- `apps/agentic-chat/src/components/tools/StopLossUI.tsx`
- `apps/agentic-chat/src/components/tools/VaultDepositUI.tsx`
- `apps/agentic-chat/src/components/tools/VaultWithdrawUI.tsx`
- `apps/agentic-chat/src/components/tools/VaultWithdrawAllUI.tsx`
- `apps/agentic-chat/src/components/tools/CancelConditionalOrderUI.tsx`
- `apps/agentic-chat/src/components/tools/CancelLimitOrderUI.tsx`

**Reference patterns:**
- `apps/agentic-chat/src/components/ui/TxStepCard.tsx` — existing subtitle rendering (line ~128)
- `apps/agentic-chat/src/lib/steps/` — reusable step functions (switchNetworkStep, etc.) that should also call setSubstatus

## Typical substatus text per phase

- Network switch: "Requesting wallet switch..."
- Approval: "Requesting approval signature..." → "Waiting for confirmation..."
- Transaction submit: "Requesting signature..." → "Submitting transaction..." → "Confirming on-chain..."
- CoW Protocol submit: "Signing order..." → "Submitting to CoW Protocol..."
- Safe transaction: "Proposing Safe transaction..." → "Waiting for confirmations..."
- Preparing: "Fetching quote..." / "Building transactions..."

## Gotchas

- `advanceStep` and `skipStep` must clear substatus — otherwise a stale message from step N appears briefly on step N+1
- `failAndPersist` should also clear substatus before persisting
- The `subtitle` prop on `Execution.Step` can still be passed directly for static subtitles — the `state.substatus` value should be a fallback/override, not replace the prop entirely
- Shared step helpers in `lib/steps/` (like `switchNetworkStep`) should call `ctx.setSubstatus()` so all tools get consistent messaging for common phases

## Acceptance Criteria

- [ ] `ToolExecutionState` has a transient `substatus` field that is NOT persisted to localStorage
- [ ] `ExecutionContext` exposes `setSubstatus(text?: string)` method
- [ ] `advanceStep`, `skipStep`, and `failAndPersist` auto-clear substatus
- [ ] `Execution.Step` component reads `state.substatus` and passes it as `subtitle`
- [ ] All transactional tool UIs show appropriate substatus text during in-progress steps
- [ ] Shared step helpers (switchNetworkStep, etc.) set substatus for consistent messaging
- [ ] Substatus text does not appear on completed, failed, or skipped steps
- [ ] Rehydrated persisted states do not show stale substatus text
- [ ] Lint and type-check pass
