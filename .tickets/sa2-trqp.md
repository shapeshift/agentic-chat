---
id: sa2-trqp
status: open
deps: []
links: []
created: 2026-03-10T02:46:21Z
type: task
priority: 2
assignee: Jibles
---
# Refactor ToolExecutionState to discriminated union for type-safe narrowing

## Objective

Refactor `ToolExecutionState` from a generic interface (`ToolExecutionState<TMeta>`) into a proper discriminated union keyed on `toolType`, so that switching on `toolType` automatically narrows `meta` (and ideally `toolOutput`) without type casts.

## Context & Findings

**Current state:** `ToolExecutionState<TMeta = unknown>` is a generic interface where `toolType: ToolType` and `meta: TMeta` are independent. This means switching on `toolType` cannot narrow `meta`, forcing manual `as` casts everywhere (e.g., `tx as ToolExecutionState<SwapMeta>` in `activityNormalizer.ts`).

**Target state:** A `ToolMetaMap` maps each `ToolType` literal to its meta type. A discriminated union (`AnyToolExecutionState`) allows `switch (tx.toolType)` to narrow `tx.meta` automatically.

**Key design decision — `useToolExecution` hook refactor:**
The hook is currently generic over `TMeta`: `useToolExecution<TMeta>(toolCallId, toolType, initialMeta)`. To make the discriminated union flow end-to-end (store → normalizer → UI), the hook should become generic over `ToolType` instead: `useToolExecution<K extends ToolType>(toolCallId, toolType: K, initialMeta: ToolMetaMap[K])`. TypeScript will infer `K` from the `toolType` argument, so call sites simplify from `useToolExecution<SwapMeta>(id, 'swap', {})` to `useToolExecution(id, 'swap', {})`.

**Rejected approach — targeted normalizer-only fix:**
We tried updating only the normalizer to accept `AnyToolExecutionState` while keeping the store as `ToolExecutionState<unknown>`. This doesn't work because `ToolExecutionState<unknown>` (with `toolType: ToolType`) is not assignable to the discriminated union (which requires specific `toolType` literals). The fix must flow through the store types, which means the hooks that write to the store must also produce the right types. Half-measures just move the casts around.

**Meta type → ToolType mappings** (confirmed from hook call sites):
- `swap` → `SwapMeta`
- `send` → `SendMeta`
- `network_switch` → `NetworkSwitchMeta` (currently defined locally in `SwitchNetworkUI.tsx`, needs moving)
- `limit_order` → `LimitOrderMeta`
- `cancel_limit_order` → `CancelLimitOrderMeta`
- `stop_loss` → `ConditionalOrderMeta`
- `cancel_stop_loss` → `CancelConditionalOrderMeta`
- `twap` → `ConditionalOrderMeta`
- `cancel_twap` → `CancelConditionalOrderMeta`
- `vault_deposit` → `VaultDepositMeta`
- `vault_withdraw` → `VaultWithdrawMeta`
- `vault_withdraw_all` → `VaultWithdrawAllMeta`

**Gotcha — shared meta types:** `ConditionalOrderMeta` is used for both `stop_loss` and `twap`; `CancelConditionalOrderMeta` for both `cancel_stop_loss` and `cancel_twap`. The `ToolMetaMap` handles this fine (multiple keys can map to the same type), but `useConditionalOrderExecution` accepts `toolType: 'stop_loss' | 'cancel_stop_loss'` — verify this still works with the constrained generic.

## Files

- `apps/agentic-chat/src/lib/executionState.ts` — add `ToolMetaMap`, `NetworkSwitchMeta`, `AnyToolExecutionState` union; keep generic interface for helper functions (`advanceStep`, `failStep`, etc.)
- `apps/agentic-chat/src/hooks/useToolExecution.ts` — change generic from `<TMeta>` to `<K extends ToolType>`, derive meta from `ToolMetaMap[K]`; update `ExecutionContext` type accordingly
- `apps/agentic-chat/src/stores/chatStore.ts` — change `persistedTransactions` and `runtimeToolStates` to use `AnyToolExecutionState`; update `persistTransaction`, `getRuntimeState`, `setRuntimeState` signatures
- `apps/agentic-chat/src/lib/activityNormalizer.ts` — accept `AnyToolExecutionState`, remove all `as` casts in switch
- `apps/agentic-chat/src/components/Portfolio/ActivityList.tsx` — should just work once store types are updated
- `apps/agentic-chat/src/components/tools/SwitchNetworkUI.tsx` — remove local `NetworkSwitchMeta`, import from `executionState`
- `apps/agentic-chat/src/components/tools/*.tsx` — remove explicit type params from `useToolExecution` calls (inference handles it)
- `apps/agentic-chat/src/components/Execution.tsx` — update `ToolExecutionState` usage to `AnyToolExecutionState` if needed
- `apps/agentic-chat/src/lib/__tests__/activityNormalizer.test.ts` — update test factory to produce `AnyToolExecutionState`
- `apps/agentic-chat/src/lib/__tests__/executionState.test.ts` — update test factory if needed

## Gotchas

- `useConditionalOrderExecution` takes a union toolType (`'stop_loss' | 'twap'`) — make sure `K extends ToolType` works when K is itself a union
- The store uses immer's `produce` with generic types — verify immer can infer the draft type correctly after the refactor
- `NetworkSwitchMeta` has a `phase` field with a union type (`NetworkSwitchPhase`) — move both the meta interface and the phase type to `executionState.ts`
- Helper functions (`advanceStep`, `failStep`, `skipStep`, `markTerminal`) only touch shared fields — they can stay generic over `TMeta` or be updated to work with the union, either works

## Acceptance Criteria

- [ ] `ToolMetaMap` type maps every `ToolType` to its meta type
- [ ] `AnyToolExecutionState` is a discriminated union — switching on `toolType` narrows `meta`
- [ ] `useToolExecution` infers meta type from `toolType` argument — no explicit type params at call sites
- [ ] `activityNormalizer.ts` has zero `as` type casts for meta narrowing
- [ ] `NetworkSwitchMeta` moved from `SwitchNetworkUI.tsx` to `executionState.ts`
- [ ] Store types (`persistedTransactions`, `runtimeToolStates`) use the discriminated union
- [ ] All existing tests pass (`bun test`)
- [ ] Lint and type-check pass (`npx tsc --noEmit`)
