---
id: sa-thpj
status: open
deps: []
links: []
created: 2026-03-06T02:26:09Z
type: chore
priority: 2
assignee: Jibles
---
# Unify tool execution hydration/persistence into single-state architecture

## Objective

Refactor the tool execution hooks to eliminate the dual-state architecture (runtime state vs persisted state) that forces every tool to implement bidirectional converter functions, a copy-pasted hydration useEffect, and manual persist calls. The goal is a single JSON-serializable state shape that serves as both runtime and persisted state, with hydration and persistence handled centrally in the shared hook.

## Context & Findings

### Current Architecture

Every tool execution hook (11 total, 9 with full implementations) follows an identical but independently implemented pattern:

1. **Hydration useEffect** — Each hook has a ~15-line useEffect with `hasHydratedRef` and `lastToolCallIdRef` that checks `runtimeToolStates`, falls back to `getPersistedTransaction()`, converts via `fromPersistedState()`, and calls `initializeRuntimeState()`. This is copy-pasted verbatim across all 9 hooks.

2. **`useToolExecutionEffect`** — Shared hook (67 lines) that guards against re-execution via 3 checks: (a) `persistedTransaction` exists, (b) `data` is null, (c) `hasRuntimeState`. If all pass, initializes state and fires the async execute callback.

3. **Dual state representations:**
   - **Runtime state** (`runtimeToolStates: Map<string, unknown>`) — tool-specific types like `SwapState` with `Set<Step>`, `currentStep`, etc. In-memory only, not persisted.
   - **Persisted state** (`persistedTransactions: PersistedToolState[]`) — generic type with `phases: string[]` and `meta: Record<string, unknown>`. Serialized to localStorage via zustand persist middleware.

4. **Per-tool converter boilerplate** — Every tool defines `toPersistedState()` (~20 lines) and `fromPersistedState()` (~10 lines) to translate between the two representations. This is ~30-50 lines of pure boilerplate per tool.

5. **Phase string serialization** — `createStepPhaseMap` converts `Set<Step>` ↔ `string[]` (e.g., `SwapStep.NETWORK_SWITCH` ↔ `'network_switched'`). These human-readable phase strings are never consumed by anything other than the converter functions themselves.

6. **Terminal state detection** — `persistTransaction()` in `chatStore.ts` (lines 196-233) manually checks for every possible tx hash field name (`swapTxHash`, `sendTxHash`, `depositTxHash`, `cancelTxHash`, `withdrawTxHash`, `submitTxHash`, `approvalTxHash`) plus `orderId` to determine immutability. Every new tool type requires updating this list.

7. **Component duplication** — All 10 UI components independently implement: historical skip check, step array destructuring/validation, error footer logic, and completed step count calculation.

### Tools Affected

| Hook | File | Steps | Key Difference |
|------|------|-------|---------------|
| useVaultDepositExecution | hooks/useVaultDepositExecution.ts | 3 | Simple EOA transfer |
| useVaultWithdrawExecution | hooks/useVaultWithdrawExecution.ts | 3 | Safe-based withdraw |
| useVaultWithdrawAllExecution | hooks/useVaultWithdrawAllExecution.ts | 2 | Multi-chain batch, JSON meta |
| useSendExecution | hooks/useSendExecution.ts | 3 | EVM + Solana, dynamic skip |
| useSwapExecution | hooks/useSwapExecution.tsx | 6 | Conditional approval |
| useLimitOrderExecution | hooks/useLimitOrderExecution.tsx | 7 | EIP-712 signing, CoW submit |
| useCancelLimitOrderExecution | hooks/useCancelLimitOrderExecution.tsx | 5 | EIP-712 cancel |
| useConditionalOrderExecution | hooks/useConditionalOrderExecution.tsx | 9 | Generic config, 3 tx hashes |
| useCancelConditionalOrderExecution | hooks/useCancelConditionalOrderExecution.tsx | 5 | Safe cancel |
| useStopLossExecution (wrapper) | hooks/useStopLossExecution.tsx | — | Delegates to conditional |
| useTwapExecution (wrapper) | hooks/useTwapExecution.tsx | — | Delegates to conditional |

### Design Decisions

**Unified state shape** — Runtime state and persisted state should be the same type. The reason they're currently split is `Set<Step>` isn't JSON-serializable, but using `number[]` instead of `Set` is trivial and eliminates the entire converter layer.

**Explicit terminal flag** — Replace the fragile N-field hash check with a `terminal: boolean` field on the state. The executing hook sets `terminal: true` on success; the store just checks that one field.

**Centralized hydration** — Move the hydration logic into `useToolExecutionEffect` itself. Every hook passes the same pattern; the shared hook should own it. This eliminates the per-hook hydration useEffect entirely.

**Auto-persist on terminal/error** — Instead of every hook manually calling `persistState()` in both success and catch blocks, the shared hook should auto-persist when the state becomes terminal or when the execute callback throws/sets an error.

**Step-builder context** — Replace raw `setState(draft => { draft.completedSteps.add(...); draft.currentStep = ... })` with helpers like `ctx.completeStep(step)`, `ctx.failStep(step, error)`, `ctx.skipStep(step)`, `ctx.updateMeta(partial)`.

### Rejected Approaches

- **React Query** — Evaluated but not suitable. The core problem is imperative wallet operations (sign, send, switch network), not data fetching. React Query's value is declarative fetch/cache/invalidate. Could help with receipt polling but that's minor.
- **Separate persistence store** — Adding another store would increase complexity. The current zustand persist approach works well; the issue is the dual-state indirection, not the storage mechanism.

## Files

### Primary changes
- `apps/agentic-chat/src/hooks/useToolExecutionEffect.ts` — Expand to handle hydration, auto-persistence, and provide step-builder context
- `apps/agentic-chat/src/stores/chatStore.ts` — Simplify `PersistedToolState` type, replace terminal hash check with `terminal` flag, update `persistTransaction`
- `apps/agentic-chat/src/lib/stepUtils.ts` — May simplify or remove `createStepPhaseMap` if phases are replaced with number arrays

### Per-tool hooks (remove converter functions, hydration useEffect)
- `apps/agentic-chat/src/hooks/useVaultDepositExecution.ts`
- `apps/agentic-chat/src/hooks/useVaultWithdrawExecution.ts`
- `apps/agentic-chat/src/hooks/useVaultWithdrawAllExecution.ts`
- `apps/agentic-chat/src/hooks/useSendExecution.ts`
- `apps/agentic-chat/src/hooks/useSwapExecution.tsx`
- `apps/agentic-chat/src/hooks/useLimitOrderExecution.tsx`
- `apps/agentic-chat/src/hooks/useCancelLimitOrderExecution.tsx`
- `apps/agentic-chat/src/hooks/useConditionalOrderExecution.tsx`
- `apps/agentic-chat/src/hooks/useCancelConditionalOrderExecution.tsx`
- `apps/agentic-chat/src/hooks/useStopLossExecution.tsx`
- `apps/agentic-chat/src/hooks/useTwapExecution.tsx`

### UI components (extract shared patterns)
- `apps/agentic-chat/src/components/tools/VaultDepositUI.tsx`
- `apps/agentic-chat/src/components/tools/VaultWithdrawUI.tsx`
- `apps/agentic-chat/src/components/tools/VaultWithdrawAllUI.tsx`
- `apps/agentic-chat/src/components/tools/SendUI.tsx`
- `apps/agentic-chat/src/components/tools/InitiateSwapUI.tsx`
- `apps/agentic-chat/src/components/tools/LimitOrderUI.tsx`
- `apps/agentic-chat/src/components/tools/CancelLimitOrderUI.tsx`
- `apps/agentic-chat/src/components/tools/StopLossUI.tsx`
- `apps/agentic-chat/src/components/tools/TwapUI.tsx`
- `apps/agentic-chat/src/components/tools/CancelConditionalOrderUI.tsx`

### Reference
- `apps/agentic-chat/src/lib/activityNormalizer.ts` — Consumes `PersistedToolState`, will need updates if shape changes

## Gotchas

- `persistedTransactions` is already in localStorage for existing users — need a zustand `migrate` function (bump STORE_VERSION to 3) to convert old `phases: string[]` records to the new shape, or handle both formats during a transition period
- `useVaultWithdrawAllExecution` stores `chainResults` as a JSON string in meta — this is the most complex per-tool meta and a good stress test for the unified shape
- `useConditionalOrderExecution` is used as a generic base by stop-loss and TWAP — changes here cascade to those wrappers
- The `activityNormalizer.ts` reads `phases` and `meta` from persisted state to build activity feed items — must be updated in lockstep
- `runtimeToolStates` is a `Map<string, unknown>` — if moving to unified state, the type safety improvement should use discriminated unions on `toolType` rather than staying with `unknown`
- The wrapper hooks (useStopLossExecution, useTwapExecution) delegate entirely to useConditionalOrderExecution — they mostly just provide config objects and should remain thin

## Acceptance Criteria

- [ ] Single state type used for both runtime and persistence (no toPersistedState/fromPersistedState converter pairs)
- [ ] Hydration logic lives in useToolExecutionEffect, not duplicated in each hook
- [ ] Per-tool hooks contain only execution logic and step/meta definitions — no hydration useEffects
- [ ] Terminal state uses explicit flag, not per-field hash checks in persistTransaction
- [ ] completedSteps uses number[] (or similar serializable type) instead of Set<Step>
- [ ] createStepPhaseMap and phase string serialization removed or replaced with direct number persistence
- [ ] Zustand store migration handles existing localStorage data (STORE_VERSION bump)
- [ ] activityNormalizer updated to work with new state shape
- [ ] All 10 UI components still render correctly for both live execution and historical/hydrated states
- [ ] Existing tool execution flows (swap, send, limit order, stop-loss, TWAP, vault deposit/withdraw, cancellations) work end-to-end
- [ ] Lint and type-check pass
