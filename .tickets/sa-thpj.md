---
id: sa-thpj
status: closed
deps: []
links: []
created: 2026-03-06T02:26:09Z
type: chore
priority: 2
assignee: Jibles
---
# Unify Tool Execution — Single-State + Compositional Architecture

## Approved Approach: Composition Not Configuration (Approach D)

Compose reusable primitives at both hook and UI layers rather than configuring a monolithic orchestrator.

## Unified State Shape

Single `ToolExecutionState<TMeta>` type for both runtime and persistence — no converter functions.

```typescript
interface ToolExecutionState<TMeta = Record<string, unknown>> {
  toolCallId: string
  toolType: ToolType
  conversationId: string
  timestamp: number
  walletAddress?: string
  toolOutput?: ToolOutput

  currentStep: number
  completedSteps: number[]
  skippedSteps: number[]
  failedStep?: number
  error?: string
  terminal: boolean

  meta: TMeta
}
```

Per-tool meta types (typed, no more Record<string, unknown> casts):
- `SwapMeta { approvalTxHash?: string; swapTxHash?: string; networkName?: string }`
- `SendMeta { sendTxHash?: string; networkName?: string }`
- `LimitOrderMeta { orderId?: string; submitTxHash?: string }`
- `ConditionalOrderMeta { approvalTxHash?: string; depositTxHash?: string; submitTxHash?: string; orderId?: string }`
- `VaultDepositMeta { depositTxHash?: string }`
- `VaultWithdrawMeta { withdrawTxHash?: string }`
- `VaultWithdrawAllMeta { chainResults: ChainResult[] }`
- Cancel variants mirror their parent's meta

## Architecture — Three Composable Layers

### 1. State Layer

- `ToolExecutionState<TMeta>` is the single type for runtime and persistence
- `runtimeToolStates: Map<string, ToolExecutionState>` (properly typed, no more `unknown`)
- `persistedTransactions: ToolExecutionState[]` (replaces `PersistedToolState[]`)
- Terminal detection: check `state.terminal` (replaces 7-field hash check)
- Store migration: STORE_VERSION bump to 3, wipe old `persistedTransactions` to `[]` (beta, no data migration)

### 2. Hook Layer — Composable Primitives

**`useToolExecution<TMeta>(toolCallId, data, toolType, stepCount)`**
- Creates `ExecutionContext<TMeta>`
- Handles hydration from persisted state (no conversion — same type)
- Auto-persists when `terminal` or `error` is set
- Sets up wallet/conversation refs for async closures
- Returns `ExecutionContext<TMeta>`

**`useExecuteOnce(ctx, data, executor)`**
- Same 3 guards: persisted exists → skip, data null → skip, hasRuntimeState → skip
- Initializes runtime state, calls executor once
- Top-level try/catch for unhandled errors

**`ExecutionContext<TMeta>` interface:**
```typescript
interface ExecutionContext<TMeta> {
  state: ToolExecutionState<TMeta>
  toolCallId: string
  runStep(fn: () => Promise<void>): Promise<void>
  skipStep(): void
  setMeta(partial: Partial<TMeta>): void
  markTerminal(): void
  refs: {
    evmWallet: MutableRefObject<EvmWallet | null>
    solanaWallet: MutableRefObject<SolanaWallet | null>
    evmAddress: MutableRefObject<string | undefined>
    conversationId: MutableRefObject<string | undefined>
    primaryWallet: MutableRefObject<Wallet | null>
  }
}
```

`runStep` behavior: sets currentStep, executes async fn, on success appends to completedSteps and advances counter, on error sets failedStep + error + auto-persists + rethrows.

**Shared step functions** — plain async functions composed by tools:
- `switchNetworkStep(ctx, chainId)` — used by 7/9 tools
- `approveTokenStep(ctx, spender, token, amount)` — used by swap, conditional order
- `signEip712Step(ctx, signingData)` — used by limit order, cancel limit order
- `submitSafeTxStep(ctx, safeTx)` — used by withdraw, cancel conditional

Each absorbs the confirmation wait internally — no more split approve/confirm steps.

### 3. UI Layer — Compound Components

`Execution.*` components backed by React context:

- `Execution.Root` — provides ToolExecutionState + historical/persisted status via context
- `Execution.HistoricalGuard` — renders "skipped (no saved data)" fallback if historical with no persisted data
- `Execution.Stepper` — calculates completedCount from state, wraps TxStepCard.Stepper
- `Execution.Step` — derives own status from context state via getStepStatus, renders TxStepCard.Step
- `Execution.ErrorFooter` — shows getUserFriendlyError if state.error present

Per-tool UI composes these at the call site:
```tsx
<Execution.Root state={state} toolCallId={toolCallId}>
  <Execution.HistoricalGuard>
    <TxStepCard.Root>
      {/* tool-specific header JSX */}
      <Execution.Stepper>
        <Execution.Step index={0} label="Get Quote" />
        <Execution.Step index={1} label="Switch Network" />
        <Execution.Step index={2} label="Approve Token" />
        <Execution.Step index={3} label="Execute Swap" />
      </Execution.Stepper>
      <Execution.ErrorFooter />
    </TxStepCard.Root>
  </Execution.HistoricalGuard>
</Execution.Root>
```

Conditional steps: just don't render the `<Execution.Step>` — stepper adjusts totalCount via Children.count.

## Step Count Changes (Collapsed Confirm Steps)

Approval + confirmation, deposit + confirmation, cancel + confirmation all collapse into single steps.

| Tool | Before | After | Steps |
|------|--------|-------|-------|
| Swap | 6 | 4 | Quote, Network, Approve, Swap |
| Conditional Order | 9 | 6 | Prepare, Network, Safe Check, Deposit, Approve, Submit |
| Cancel Conditional | 5 | 4 | Prepare, Network, Safe Check, Cancel |
| Cancel Limit | 5 | 4 | Prepare, Network, Sign, Cancel |
| Limit Order | 7 | 5 | Prepare, Network, Approve, Sign, Submit |
| Send | 3 | 3 | Prepare, Network, Send |
| Vault Deposit | 3 | 3 | Prepare, Network, Deposit |
| Vault Withdraw | 3 | 3 | Prepare, Network, Withdraw |
| Vault Withdraw All | 2 | 2 | Prepare, Execute |

## Deletions

- `PersistedToolState` type
- `createStepPhaseMap` and all phase string mappings
- All `toPersistedState()` / `fromPersistedState()` converter pairs (9 tools)
- All per-hook hydration useEffect blocks (9 tools)
- `StepState` type with `Set<Step>`
- 7-field terminal hash check in `persistTransaction`
- Per-component historical skip check, step array destructuring, completedCount calculation, error footer logic

## Activity Normalizer Updates

Reads from `ToolExecutionState<TMeta>` directly — typed meta access replaces `as string` casts. Mechanical change, same field mapping logic.

## Store Changes

- `STORE_VERSION = 3`
- Migration: version < 3 → `{ persistedTransactions: [] }`
- `persistTransaction`: terminal guard simplifies to `if (existing?.terminal) return`
- `runtimeToolStates` type: `Map<string, ToolExecutionState>` (was `Map<string, unknown>`)

## Testing

### Pure function unit tests
1. State transition functions — `advanceStep`, `failStep`, `skipStepState`, `markTerminalState`
2. `getStepStatus` — with number[] inputs, all status variants
3. Activity normalizer — typed ToolExecutionState inputs → ActivityItem outputs

### Flow tests (mock wallet boundary only)
4. Executor integration (swap, conditionalOrder, send) — real ExecutionContext + real zustand store, mock only wallet calls. Tests branching (needs approval?), skip logic, error handling, final state shape.
5. Hydration round-trip — persist state → create new context for same toolCallId → verify hydrated state matches

### Not tested
- Render tests for Execution.* components
- Store migration
- Per-tool executors beyond the representative 3

## Files

### New files
- `apps/agentic-chat/src/hooks/useToolExecution.ts` — new composable hook + ExecutionContext
- `apps/agentic-chat/src/hooks/useExecuteOnce.ts` — execution guard hook
- `apps/agentic-chat/src/hooks/steps/switchNetworkStep.ts` — shared step
- `apps/agentic-chat/src/hooks/steps/approveTokenStep.ts` — shared step
- `apps/agentic-chat/src/hooks/steps/signEip712Step.ts` — shared step
- `apps/agentic-chat/src/hooks/steps/submitSafeTxStep.ts` — shared step
- `apps/agentic-chat/src/components/Execution.tsx` — compound UI components
- `apps/agentic-chat/src/lib/executionState.ts` — ToolExecutionState type, meta types, pure state transition functions

### Modified files
- `apps/agentic-chat/src/stores/chatStore.ts` — new types, simplified persistTransaction, migration
- `apps/agentic-chat/src/lib/stepUtils.ts` — update getStepStatus for number[], remove createStepPhaseMap
- `apps/agentic-chat/src/lib/activityNormalizer.ts` — use ToolExecutionState, typed meta access
- All 9 per-tool hooks — replace with composable pattern (remove converters, hydration, phase maps)
- All 10 UI components — replace with Execution.* composition

### Deleted (contents, not files)
- Per-tool: toPersistedState, fromPersistedState, hydration useEffect, step phase mappings
- stepUtils: createStepPhaseMap, StepState type
- chatStore: PersistedToolState type, terminal hash field list

## Notes

**2026-03-09T06:40:15Z**

# Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use /run tk:sa-thpj to implement this plan task-by-task via subagent-driven-development.

**Goal:** Replace the per-tool state management, serialization, hydration, and UI rendering with a unified compositional architecture using shared primitives.

**Architecture:** Three composable layers — (1) State layer with a single `ToolExecutionState<TMeta>` type for runtime and persistence, (2) Hook layer with `useToolExecution` + `useExecuteOnce` composable primitives plus shared step functions, (3) UI layer with `Execution.*` compound components. The store migrates to version 3 with simplified terminal detection via a `terminal` boolean field.

**Tech Stack:** React, Zustand (with Immer + persist middleware), TypeScript, bun:test

---

### Task 1: Create ToolExecutionState types and pure state functions

**Files:**
- Create: `apps/agentic-chat/src/lib/executionState.ts`
- Test: `apps/agentic-chat/src/lib/__tests__/executionState.test.ts`

**Step 1: Write the failing tests for state types and pure functions**

```typescript
// apps/agentic-chat/src/lib/__tests__/executionState.test.ts
import { describe, expect, it } from 'bun:test'

import {
  advanceStep,
  failStep,
  skipStep,
  markTerminal,
  getStepStatus,
  type ToolExecutionState,
} from '../executionState'
import { StepStatus } from '../stepUtils'

function makeState(overrides: Partial<ToolExecutionState> = {}): ToolExecutionState {
  return {
    toolCallId: 'tc-1',
    toolType: 'swap',
    conversationId: 'conv-1',
    timestamp: 1000,
    currentStep: 0,
    completedSteps: [],
    skippedSteps: [],
    terminal: false,
    meta: {},
    ...overrides,
  }
}

describe('advanceStep', () => {
  it('marks current step complete and increments', () => {
    const state = makeState({ currentStep: 1 })
    const next = advanceStep(state)
    expect(next.completedSteps).toContain(1)
    expect(next.currentStep).toBe(2)
  })

  it('does not duplicate completed steps', () => {
    const state = makeState({ currentStep: 1, completedSteps: [0, 1] })
    const next = advanceStep(state)
    expect(next.completedSteps.filter(s => s === 1)).toHaveLength(1)
  })
})

describe('failStep', () => {
  it('sets failedStep, error, and terminal', () => {
    const state = makeState({ currentStep: 2 })
    const next = failStep(state, 'something broke')
    expect(next.failedStep).toBe(2)
    expect(next.error).toBe('something broke')
    expect(next.terminal).toBe(true)
  })
})

describe('skipStep', () => {
  it('adds step to skippedSteps and advances', () => {
    const state = makeState({ currentStep: 1 })
    const next = skipStep(state)
    expect(next.skippedSteps).toContain(1)
    expect(next.currentStep).toBe(2)
  })
})

describe('markTerminal', () => {
  it('sets terminal to true', () => {
    const state = makeState()
    const next = markTerminal(state)
    expect(next.terminal).toBe(true)
  })
})

describe('getStepStatus (number[] version)', () => {
  it('returns FAILED when step matches failedStep', () => {
    const state = makeState({ currentStep: 2, failedStep: 2, error: 'err' })
    expect(getStepStatus(2, state)).toBe(StepStatus.FAILED)
  })

  it('returns NOT_STARTED when currentStep is before the queried step', () => {
    const state = makeState({ currentStep: 0 })
    expect(getStepStatus(2, state)).toBe(StepStatus.NOT_STARTED)
  })

  it('returns IN_PROGRESS when currentStep equals step and no error', () => {
    const state = makeState({ currentStep: 1, completedSteps: [0] })
    expect(getStepStatus(1, state)).toBe(StepStatus.IN_PROGRESS)
  })

  it('returns COMPLETE when step is in completedSteps', () => {
    const state = makeState({ currentStep: 2, completedSteps: [0, 1] })
    expect(getStepStatus(0, state)).toBe(StepStatus.COMPLETE)
    expect(getStepStatus(1, state)).toBe(StepStatus.COMPLETE)
  })

  it('returns SKIPPED when step is in skippedSteps', () => {
    const state = makeState({ currentStep: 2, skippedSteps: [1] })
    expect(getStepStatus(1, state)).toBe(StepStatus.SKIPPED)
  })

  it('returns SKIPPED when step is past but not in completedSteps or skippedSteps', () => {
    const state = makeState({ currentStep: 3, completedSteps: [0] })
    expect(getStepStatus(1, state)).toBe(StepStatus.SKIPPED)
  })

  it('FAILED takes precedence over COMPLETE', () => {
    const state = makeState({ currentStep: 2, completedSteps: [2], failedStep: 2, error: 'err' })
    expect(getStepStatus(2, state)).toBe(StepStatus.FAILED)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd apps/agentic-chat && bun test src/lib/__tests__/executionState.test.ts`
Expected: FAIL — module `../executionState` not found

**Step 3: Write executionState.ts with types and pure functions**

```typescript
// apps/agentic-chat/src/lib/executionState.ts
import type {
  CancelLimitOrderOutput,
  CancelStopLossOutput,
  CreateLimitOrderOutput,
  CreateStopLossOutput,
  CreateTwapOutput,
  InitiateSwapOutput,
  SendOutput,
  SwitchNetworkOutput,
  VaultDepositOutput,
  VaultWithdrawAllOutput,
  VaultWithdrawOutput,
} from '@shapeshiftoss/agentic-server'

import { StepStatus } from './stepUtils'

export type ToolType =
  | 'swap'
  | 'send'
  | 'network_switch'
  | 'limit_order'
  | 'cancel_limit_order'
  | 'stop_loss'
  | 'cancel_stop_loss'
  | 'twap'
  | 'cancel_twap'
  | 'vault_deposit'
  | 'vault_withdraw'
  | 'vault_withdraw_all'

export type ToolOutput =
  | InitiateSwapOutput
  | SendOutput
  | SwitchNetworkOutput
  | CreateLimitOrderOutput
  | CancelLimitOrderOutput
  | CreateStopLossOutput
  | CancelStopLossOutput
  | CreateTwapOutput
  | VaultDepositOutput
  | VaultWithdrawOutput
  | VaultWithdrawAllOutput

export interface ToolExecutionState<TMeta = Record<string, unknown>> {
  toolCallId: string
  toolType: ToolType
  conversationId: string
  timestamp: number
  walletAddress?: string
  toolOutput?: ToolOutput

  currentStep: number
  completedSteps: number[]
  skippedSteps: number[]
  failedStep?: number
  error?: string
  terminal: boolean

  meta: TMeta
}

// Per-tool meta types
export interface SwapMeta {
  approvalTxHash?: string
  swapTxHash?: string
  networkName?: string
}

export interface SendMeta {
  sendTxHash?: string
  networkName?: string
}

export interface LimitOrderMeta {
  orderId?: string
  submitTxHash?: string
  approvalTxHash?: string
  networkName?: string
}

export interface ConditionalOrderMeta {
  approvalTxHash?: string
  depositTxHash?: string
  submitTxHash?: string
  orderId?: string
  networkName?: string
}

export interface CancelLimitOrderMeta {
  orderId?: string
  networkName?: string
}

export interface CancelConditionalOrderMeta {
  cancelTxHash?: string
}

export interface VaultDepositMeta {
  depositTxHash?: string
  networkName?: string
}

export interface VaultWithdrawMeta {
  withdrawTxHash?: string
  networkName?: string
}

export interface ChainResult {
  network: string
  chainId: number
  txHash?: string
  error?: string
}

export interface VaultWithdrawAllMeta {
  chainResults: ChainResult[]
  currentChainIndex?: number
}

// Pure state transition functions
export function advanceStep<TMeta>(state: ToolExecutionState<TMeta>): ToolExecutionState<TMeta> {
  const completedSteps = state.completedSteps.includes(state.currentStep)
    ? state.completedSteps
    : [...state.completedSteps, state.currentStep]
  return { ...state, completedSteps, currentStep: state.currentStep + 1, error: undefined }
}

export function failStep<TMeta>(state: ToolExecutionState<TMeta>, error: string): ToolExecutionState<TMeta> {
  return { ...state, failedStep: state.currentStep, error, terminal: true }
}

export function skipStep<TMeta>(state: ToolExecutionState<TMeta>): ToolExecutionState<TMeta> {
  const skippedSteps = state.skippedSteps.includes(state.currentStep)
    ? state.skippedSteps
    : [...state.skippedSteps, state.currentStep]
  return { ...state, skippedSteps, currentStep: state.currentStep + 1 }
}

export function markTerminal<TMeta>(state: ToolExecutionState<TMeta>): ToolExecutionState<TMeta> {
  return { ...state, terminal: true }
}

export function getStepStatus(step: number, state: ToolExecutionState): StepStatus {
  if (state.failedStep === step) return StepStatus.FAILED
  if (state.currentStep < step) return StepStatus.NOT_STARTED
  if (state.currentStep === step && !state.error) return StepStatus.IN_PROGRESS
  if (state.completedSteps.includes(step)) return StepStatus.COMPLETE
  if (state.skippedSteps?.includes(step)) return StepStatus.SKIPPED
  if (state.currentStep > step) return StepStatus.SKIPPED
  return StepStatus.NOT_STARTED
}
```

**Step 4: Run tests to verify they pass**

Run: `cd apps/agentic-chat && bun test src/lib/__tests__/executionState.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add apps/agentic-chat/src/lib/executionState.ts apps/agentic-chat/src/lib/__tests__/executionState.test.ts
git commit -m "feat: add ToolExecutionState types and pure state transition functions"
```

---

### Task 2: Update chatStore with new types, migration, and simplified terminal guard

**Files:**
- Modify: `apps/agentic-chat/src/stores/chatStore.ts`

**Step 1: Write the failing test for store migration and terminal guard**

Create a test that imports the new store shape.

```typescript
// apps/agentic-chat/src/stores/__tests__/chatStoreMigration.test.ts
import { describe, expect, it } from 'bun:test'

// Since chatStore uses React hooks (zustand), we test the migration logic and terminal guard
// as pure functions extracted from the store. For now, test that STORE_VERSION is 3.
import { STORE_VERSION } from '../chatStore'

describe('chatStore migration', () => {
  it('has STORE_VERSION 3', () => {
    expect(STORE_VERSION).toBe(3)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd apps/agentic-chat && bun test src/stores/__tests__/chatStoreMigration.test.ts`
Expected: FAIL — STORE_VERSION is 2

**Step 3: Update chatStore.ts**

Changes needed:
1. Bump `STORE_VERSION` to 3 and export it
2. Replace `PersistedToolState` with import of `ToolExecutionState` from `executionState.ts`
3. Change `persistedTransactions: PersistedToolState[]` → `persistedTransactions: ToolExecutionState[]`
4. Change `runtimeToolStates: Map<string, unknown>` → `Map<string, ToolExecutionState>`
5. Simplify `persistTransaction` terminal guard: `if (existing?.terminal) return storeState`
6. Update `persistTransaction` signature to accept `ToolExecutionState`
7. Add migration: `if (version < 3) { state.persistedTransactions = [] }`
8. Keep `PersistedToolState` as a deprecated type alias for backwards compat during migration (will be removed in later tasks)

The key changes in `chatStore.ts`:
- Import `ToolExecutionState` from `@/lib/executionState`
- `export const STORE_VERSION = 3`
- `export type PersistedToolState = ToolExecutionState` (temporary alias for gradual migration)
- `persistTransaction: (state: ToolExecutionState) => void` in the interface
- Simplify terminal guard in `persistTransaction`:
  ```typescript
  if (existing?.terminal) {
    return storeState
  }
  ```
- Migration:
  ```typescript
  migrate: (persisted, version) => {
    const state = persisted as Record<string, unknown>
    if (version < 2) {
      state.messagesByConversation = {}
    }
    if (version < 3) {
      state.persistedTransactions = []
    }
    return state as unknown as ChatState
  },
  ```

**Step 4: Run test to verify it passes**

Run: `cd apps/agentic-chat && bun test src/stores/__tests__/chatStoreMigration.test.ts`
Expected: PASS

**Step 5: Run existing tests to verify nothing breaks**

Run: `cd apps/agentic-chat && bun test`
Expected: All existing tests still pass (serialization tests use PersistedToolState which is now an alias)

**Step 6: Commit**

```bash
git add apps/agentic-chat/src/stores/chatStore.ts apps/agentic-chat/src/stores/__tests__/chatStoreMigration.test.ts
git commit -m "feat: bump store to v3 with ToolExecutionState, simplified terminal guard"
```

---

### Task 3: Create useToolExecution hook (ExecutionContext)

**Files:**
- Create: `apps/agentic-chat/src/hooks/useToolExecution.ts`

**Step 1: Write useToolExecution hook**

This hook creates the `ExecutionContext<TMeta>` that replaces the per-tool boilerplate (wallet refs, hydration, persistence, step advancement).

```typescript
// apps/agentic-chat/src/hooks/useToolExecution.ts
import { useDynamicContext, useSwitchWallet } from '@dynamic-labs/sdk-react-core'
import type { MutableRefObject } from 'react'
import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'

import type { ToolExecutionState, ToolType } from '@/lib/executionState'
import { useChatStore } from '@/stores/chatStore'

import { useWalletConnection } from './useWalletConnection'

export interface ExecutionContext<TMeta> {
  state: ToolExecutionState<TMeta>
  toolCallId: string
  setState: (updater: (draft: ToolExecutionState<TMeta>) => void) => void
  advanceStep: () => void
  skipStep: () => void
  setMeta: (partial: Partial<TMeta>) => void
  markTerminal: () => void
  persist: () => void
  refs: {
    evmWallet: MutableRefObject<ReturnType<typeof useWalletConnection>['evmWallet']>
    solanaWallet: MutableRefObject<ReturnType<typeof useWalletConnection>['solanaWallet']>
    evmAddress: MutableRefObject<string | undefined>
    solanaAddress: MutableRefObject<string | undefined>
    conversationId: MutableRefObject<string | undefined>
    primaryWallet: MutableRefObject<ReturnType<typeof useDynamicContext>['primaryWallet']>
    changePrimaryWallet: MutableRefObject<ReturnType<typeof useSwitchWallet>>
  }
}

export function useToolExecution<TMeta extends Record<string, unknown>>(
  toolCallId: string,
  toolType: ToolType,
  initialMeta: TMeta
): ExecutionContext<TMeta> {
  const { evmAddress, solanaAddress, solanaWallet, evmWallet } = useWalletConnection()
  const store = useChatStore()
  const { conversationId: activeConversationId } = useParams<{ conversationId?: string }>()
  const { primaryWallet } = useDynamicContext()
  const changePrimaryWallet = useSwitchWallet()

  // Stable refs for async closures
  const evmWalletRef = useRef(evmWallet)
  const solanaWalletRef = useRef(solanaWallet)
  const evmAddressRef = useRef(evmAddress)
  const solanaAddressRef = useRef(solanaAddress)
  const activeConversationIdRef = useRef(activeConversationId)
  const primaryWalletRef = useRef(primaryWallet)
  const changePrimaryWalletRef = useRef(changePrimaryWallet)
  evmWalletRef.current = evmWallet
  solanaWalletRef.current = solanaWallet
  evmAddressRef.current = evmAddress
  solanaAddressRef.current = solanaAddress
  activeConversationIdRef.current = activeConversationId
  primaryWalletRef.current = primaryWallet
  changePrimaryWalletRef.current = changePrimaryWallet

  const initialState: ToolExecutionState<TMeta> = {
    toolCallId,
    toolType,
    conversationId: activeConversationId ?? '',
    timestamp: Date.now(),
    currentStep: 0,
    completedSteps: [],
    skippedSteps: [],
    terminal: false,
    meta: initialMeta,
  }

  // Hydrate from persisted state on mount
  const hasHydratedRef = useRef(false)
  const lastToolCallIdRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (lastToolCallIdRef.current !== toolCallId) {
      hasHydratedRef.current = false
      lastToolCallIdRef.current = toolCallId
    }

    if (!hasHydratedRef.current && !store.runtimeToolStates.has(toolCallId)) {
      const persisted = store.getPersistedTransaction(toolCallId)
      if (persisted) {
        store.initializeRuntimeState(toolCallId, persisted)
        hasHydratedRef.current = true
      }
    }
  }, [toolCallId, store])

  const state = useChatStore(s => {
    const toolState = s.runtimeToolStates.get(toolCallId)
    return toolState !== undefined ? (toolState as ToolExecutionState<TMeta>) : initialState
  })

  const setState = (updater: (draft: ToolExecutionState<TMeta>) => void) => {
    store.setRuntimeState(toolCallId, updater)
  }

  const advanceStep = () => {
    setState(draft => {
      if (!draft.completedSteps.includes(draft.currentStep)) {
        draft.completedSteps.push(draft.currentStep)
      }
      draft.currentStep += 1
      draft.error = undefined
    })
  }

  const skipStepFn = () => {
    setState(draft => {
      if (!draft.skippedSteps.includes(draft.currentStep)) {
        draft.skippedSteps.push(draft.currentStep)
      }
      draft.currentStep += 1
    })
  }

  const setMeta = (partial: Partial<TMeta>) => {
    setState(draft => {
      Object.assign(draft.meta, partial)
    })
  }

  const markTerminalFn = () => {
    setState(draft => {
      draft.terminal = true
    })
  }

  const persist = () => {
    const currentState = store.getRuntimeState<ToolExecutionState<TMeta>>(toolCallId, initialState)
    const walletAddress = evmAddressRef.current ?? solanaAddressRef.current
    store.persistTransaction({
      ...currentState,
      conversationId: activeConversationIdRef.current ?? currentState.conversationId,
      timestamp: Date.now(),
      ...(walletAddress && { walletAddress }),
    })
  }

  return {
    state,
    toolCallId,
    setState,
    advanceStep,
    skipStep: skipStepFn,
    setMeta,
    markTerminal: markTerminalFn,
    persist,
    refs: {
      evmWallet: evmWalletRef,
      solanaWallet: solanaWalletRef,
      evmAddress: evmAddressRef,
      solanaAddress: solanaAddressRef,
      conversationId: activeConversationIdRef,
      primaryWallet: primaryWalletRef,
      changePrimaryWallet: changePrimaryWalletRef,
    },
  }
}
```

**Step 2: Commit**

```bash
git add apps/agentic-chat/src/hooks/useToolExecution.ts
git commit -m "feat: add useToolExecution composable hook with ExecutionContext"
```

---

### Task 4: Create useExecuteOnce hook

**Files:**
- Create: `apps/agentic-chat/src/hooks/useExecuteOnce.ts`

**Step 1: Write useExecuteOnce hook**

This replaces `useToolExecutionEffect` with the same 3-guard pattern but works with `ExecutionContext`.

```typescript
// apps/agentic-chat/src/hooks/useExecuteOnce.ts
import { useEffect, useRef } from 'react'

import { useChatStore } from '@/stores/chatStore'

import type { ExecutionContext } from './useToolExecution'

export function useExecuteOnce<TMeta extends Record<string, unknown>, TData>(
  ctx: ExecutionContext<TMeta>,
  data: TData | null,
  executor: (data: TData, ctx: ExecutionContext<TMeta>) => Promise<void>
): void {
  const { hasRuntimeState, initializeRuntimeState, getPersistedTransaction } = useChatStore()

  const persistedTransaction = useChatStore(store => store.getPersistedTransaction(ctx.toolCallId))

  const executorRef = useRef(executor)
  const ctxRef = useRef(ctx)
  executorRef.current = executor
  ctxRef.current = ctx

  useEffect(() => {
    // Guard 1: Already persisted — skip execution
    if (persistedTransaction) return

    // Guard 2: No data yet — skip execution
    if (!data) return

    // Guard 3: Already running — skip execution
    if (hasRuntimeState(ctx.toolCallId)) return

    // Initialize runtime state
    initializeRuntimeState(ctx.toolCallId, ctx.state)

    const run = async () => {
      try {
        await executorRef.current(data, ctxRef.current)
      } catch (error) {
        console.error('[useExecuteOnce] Unhandled executor error:', error)
      }
    }

    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.toolCallId, data, persistedTransaction])
}
```

**Step 2: Commit**

```bash
git add apps/agentic-chat/src/hooks/useExecuteOnce.ts
git commit -m "feat: add useExecuteOnce execution guard hook"
```

---

### Task 5: Create shared step functions

**Files:**
- Create: `apps/agentic-chat/src/hooks/steps/switchNetworkStep.ts`
- Create: `apps/agentic-chat/src/hooks/steps/approveTokenStep.ts`
- Create: `apps/agentic-chat/src/hooks/steps/signEip712Step.ts`
- Create: `apps/agentic-chat/src/hooks/steps/submitSafeTxStep.ts`

**Step 1: Create switchNetworkStep**

```typescript
// apps/agentic-chat/src/hooks/steps/switchNetworkStep.ts
import { isEthereumWallet } from '@dynamic-labs/ethereum'
import { isSolanaWallet } from '@dynamic-labs/solana'
import { CHAIN_NAMESPACE, fromChainId } from '@shapeshiftoss/caip'

import type { ExecutionContext } from '../useToolExecution'

export async function switchNetworkStep<TMeta extends Record<string, unknown>>(
  ctx: ExecutionContext<TMeta>,
  chainId: string
): Promise<void> {
  const { chainNamespace, chainReference } = fromChainId(chainId)

  if (chainNamespace !== CHAIN_NAMESPACE.Evm) {
    if (
      chainNamespace === CHAIN_NAMESPACE.Solana &&
      ctx.refs.solanaWallet.current &&
      ctx.refs.primaryWallet.current &&
      !isSolanaWallet(ctx.refs.primaryWallet.current)
    ) {
      await ctx.refs.changePrimaryWallet.current(ctx.refs.solanaWallet.current.id)
    }
    ctx.advanceStep()
    return
  }

  if (!ctx.refs.evmWallet.current) throw new Error('EVM wallet not connected')

  if (ctx.refs.primaryWallet.current && !isEthereumWallet(ctx.refs.primaryWallet.current)) {
    await ctx.refs.changePrimaryWallet.current(ctx.refs.evmWallet.current.id)
  }

  await ctx.refs.evmWallet.current.connector.switchNetwork({ networkChainId: Number(chainReference) })
  ctx.advanceStep()
}

export async function switchNetworkStepByChainIdNumber<TMeta extends Record<string, unknown>>(
  ctx: ExecutionContext<TMeta>,
  chainIdNumber: number
): Promise<void> {
  if (!ctx.refs.evmWallet.current) throw new Error('EVM wallet not connected')

  if (ctx.refs.primaryWallet.current && !isEthereumWallet(ctx.refs.primaryWallet.current)) {
    await ctx.refs.changePrimaryWallet.current(ctx.refs.evmWallet.current.id)
  }

  await ctx.refs.evmWallet.current.connector.switchNetwork({ networkChainId: chainIdNumber })
  ctx.advanceStep()
}
```

**Step 2: Create approveTokenStep**

```typescript
// apps/agentic-chat/src/hooks/steps/approveTokenStep.ts
import { CHAIN_NAMESPACE, fromChainId } from '@shapeshiftoss/caip'

import type { SolanaWalletSigner } from '@/utils/chains/types'
import { executeApproval } from '@/utils/swapExecutor'
import { waitForConfirmedReceipt } from '@/utils/waitForConfirmedReceipt'

import type { ExecutionContext } from '../useToolExecution'

interface ApproveTokenParams {
  approvalTx: { chainId: string; data: string; from: string; to: string; value: string }
  sellAssetChainId: string
  solanaSigner?: SolanaWalletSigner
}

export async function approveTokenStep<TMeta extends { approvalTxHash?: string }>(
  ctx: ExecutionContext<TMeta>,
  params: ApproveTokenParams
): Promise<string> {
  const { approvalTx, sellAssetChainId, solanaSigner } = params

  const approvalTxHash = await executeApproval(approvalTx, { solanaSigner })

  ctx.setMeta({ approvalTxHash } as Partial<TMeta>)
  ctx.advanceStep()

  // Wait for confirmation (EVM only)
  const { chainNamespace, chainReference } = fromChainId(sellAssetChainId)
  if (chainNamespace === CHAIN_NAMESPACE.Evm) {
    await waitForConfirmedReceipt(Number(chainReference), approvalTxHash as `0x${string}`)
  }

  return approvalTxHash
}
```

**Step 3: Create signEip712Step**

```typescript
// apps/agentic-chat/src/hooks/steps/signEip712Step.ts
import { signTypedDataWithWallet } from '@/lib/stepUtils'

import type { ExecutionContext } from '../useToolExecution'

interface Eip712SigningData {
  domain: object
  types: object
  primaryType: string
  message: object
}

export async function signEip712Step<TMeta extends Record<string, unknown>>(
  ctx: ExecutionContext<TMeta>,
  signingData: Eip712SigningData
): Promise<string> {
  if (!ctx.refs.evmWallet.current) throw new Error('EVM wallet not connected')

  const signature = await signTypedDataWithWallet(ctx.refs.evmWallet.current, signingData)
  ctx.advanceStep()
  return signature
}
```

**Step 4: Create submitSafeTxStep**

```typescript
// apps/agentic-chat/src/hooks/steps/submitSafeTxStep.ts
import { executeSafeTransaction } from '@/lib/safe'

import type { ExecutionContext } from '../useToolExecution'

interface SafeTxParams {
  safeAddress: string
  to: string
  data: string
  value: string
  chainId: number
}

export async function submitSafeTxStep<TMeta extends Record<string, unknown>>(
  ctx: ExecutionContext<TMeta>,
  params: SafeTxParams
): Promise<string> {
  if (!ctx.refs.evmWallet.current) throw new Error('EVM wallet not connected')
  if (!ctx.refs.evmAddress.current) throw new Error('Wallet disconnected')

  const walletClient = await ctx.refs.evmWallet.current.getWalletClient()
  const txHash = await executeSafeTransaction(
    params.safeAddress,
    { to: params.to, data: params.data, value: params.value },
    ctx.refs.evmAddress.current,
    params.chainId,
    walletClient
  )
  ctx.advanceStep()
  return txHash
}
```

**Step 5: Commit**

```bash
git add apps/agentic-chat/src/hooks/steps/
git commit -m "feat: add shared step functions (switchNetwork, approveToken, signEip712, submitSafeTx)"
```

---

### Task 6: Create Execution.* compound UI components

**Files:**
- Create: `apps/agentic-chat/src/components/Execution.tsx`

**Step 1: Write the Execution compound component**

```tsx
// apps/agentic-chat/src/components/Execution.tsx
import { Children, createContext, useContext } from 'react'
import type { ReactNode } from 'react'

import type { ToolExecutionState } from '@/lib/executionState'
import { getStepStatus } from '@/lib/executionState'
import { getUserFriendlyError, StepStatus } from '@/lib/stepUtils'
import { useChatStore } from '@/stores/chatStore'

import { TruncateText } from './ui/TruncateText'
import { TxStepCard } from './ui/TxStepCard'

interface ExecutionContextValue {
  state: ToolExecutionState
  toolCallId: string
  isHistorical: boolean
  hasPersisted: boolean
}

const ExecutionCtx = createContext<ExecutionContextValue | null>(null)

function useExecutionContext(): ExecutionContextValue {
  const ctx = useContext(ExecutionCtx)
  if (!ctx) throw new Error('Execution.* components must be used within <Execution.Root>')
  return ctx
}

// --- Root ---
interface RootProps {
  state: ToolExecutionState
  toolCallId: string
  children: ReactNode
}

function Root({ state, toolCallId, children }: RootProps) {
  const { isHistorical, getPersistedTransaction } = useChatStore()
  const hasPersisted = !!getPersistedTransaction(toolCallId)

  return (
    <ExecutionCtx.Provider value={{ state, toolCallId, isHistorical: isHistorical(toolCallId), hasPersisted }}>
      {children}
    </ExecutionCtx.Provider>
  )
}

// --- HistoricalGuard ---
interface HistoricalGuardProps {
  children: ReactNode
  fallbackLabel?: string
}

function HistoricalGuard({ children, fallbackLabel = 'execution' }: HistoricalGuardProps) {
  const { isHistorical, hasPersisted } = useExecutionContext()

  if (isHistorical && !hasPersisted) {
    return (
      <TxStepCard.Root>
        <div className="text-sm text-muted-foreground font-medium p-4">
          {fallbackLabel.charAt(0).toUpperCase() + fallbackLabel.slice(1)} skipped (no saved data)
        </div>
      </TxStepCard.Root>
    )
  }

  return <>{children}</>
}

// --- Stepper ---
interface StepperProps {
  children: ReactNode
}

function Stepper({ children }: StepperProps) {
  const { state } = useExecutionContext()
  const totalCount = Children.count(children)
  const completedCount = state.completedSteps.length + state.skippedSteps.length

  return (
    <TxStepCard.Stepper completedCount={completedCount} totalCount={totalCount}>
      {children}
    </TxStepCard.Stepper>
  )
}

// --- Step ---
interface StepProps {
  index: number
  label: string
  subtitle?: string
  connectorTop?: boolean
  connectorBottom?: boolean
  overrideStatus?: StepStatus
}

function Step({ index, label, subtitle, connectorTop, connectorBottom, overrideStatus }: StepProps) {
  const { state } = useExecutionContext()
  const status = overrideStatus ?? getStepStatus(index, state)

  return (
    <TxStepCard.Step status={status} subtitle={subtitle} connectorTop={connectorTop} connectorBottom={connectorBottom}>
      {label}
    </TxStepCard.Step>
  )
}

// --- ErrorFooter ---
function ErrorFooter() {
  const { state } = useExecutionContext()
  if (!state.error) return null

  const friendlyError = getUserFriendlyError(state.error)
  return (
    <TruncateText
      text={`Execution failed: ${friendlyError}`}
      limit={80}
      className="text-sm font-medium mt-4 text-red-500"
    />
  )
}

export const Execution = {
  Root,
  HistoricalGuard,
  Stepper,
  Step,
  ErrorFooter,
}
```

**Step 2: Commit**

```bash
git add apps/agentic-chat/src/components/Execution.tsx
git commit -m "feat: add Execution.* compound UI components"
```

---

### Task 7: Migrate useSwapExecution to compositional pattern

**Files:**
- Modify: `apps/agentic-chat/src/hooks/useSwapExecution.tsx`
- Modify: `apps/agentic-chat/src/components/tools/InitiateSwapUI.tsx`
- Modify: `apps/agentic-chat/src/hooks/__tests__/swapSerialization.test.ts`

This is the first full migration. After this, the pattern is established for the remaining tools.

**Step 1: Rewrite useSwapExecution.tsx**

The hook should:
- Use `useToolExecution<SwapMeta>` instead of manual refs/hydration
- Use `useExecuteOnce` instead of `useToolExecutionEffect`
- Use `switchNetworkStep` and `approveTokenStep` shared steps
- Remove `SwapStep` enum, `SWAP_PHASES`, `SwapState`, `swapStateToPersistedState`, `persistedStateToSwapState`
- Export the step indices as constants for UI: `SWAP_STEPS = { QUOTE: 0, NETWORK: 1, APPROVE: 2, SWAP: 3 }`
- Return `ExecutionContext<SwapMeta>` or a simplified result object

The new swap has 4 steps (collapsed from 6): Quote, Network, Approve, Swap

```typescript
// apps/agentic-chat/src/hooks/useSwapExecution.tsx
import { isSolanaWallet } from '@dynamic-labs/solana'
import type { InitiateSwapOutput } from '@shapeshiftoss/agentic-server'
import { CHAIN_NAMESPACE, fromChainId } from '@shapeshiftoss/caip'
import type { DynamicToolUIPart } from 'ai'
import { toast } from 'sonner'

import { Amount } from '@/components/ui/Amount'
import type { ToolExecutionState, SwapMeta } from '@/lib/executionState'
import { getStepStatus } from '@/lib/executionState'
import { analytics } from '@/lib/mixpanel'
import { StepStatus } from '@/lib/stepUtils'
import type { SolanaWalletSigner } from '@/utils/chains/types'
import { executeApproval, executeSwap } from '@/utils/swapExecutor'
import { waitForConfirmedReceipt } from '@/utils/waitForConfirmedReceipt'

import { switchNetworkStep } from './steps/switchNetworkStep'
import { useExecuteOnce } from './useExecuteOnce'
import { useToolExecution } from './useToolExecution'

export const SWAP_STEPS = { QUOTE: 0, NETWORK: 1, APPROVE: 2, SWAP: 3 } as const

type SwapData = InitiateSwapOutput

interface SwapStepInfo {
  step: number
  status: StepStatus
}

interface UseSwapExecutionResult {
  state: ToolExecutionState<SwapMeta>
  steps: SwapStepInfo[]
  networkName?: string
  error?: string
  approvalTxHash?: string
  swapTxHash?: string
}

export const useSwapExecution = (
  toolCallId: string,
  toolState: DynamicToolUIPart['state'],
  swapData: SwapData | null
): UseSwapExecutionResult => {
  const ctx = useToolExecution<SwapMeta>(toolCallId, 'swap', {})

  useExecuteOnce(ctx, swapData, async (data, ctx) => {
    try {
      const { needsApproval, approvalTx, swapTx } = data

      if (!swapTx?.from) throw new Error('Invalid swap output: missing swapTx.from')
      if (!swapTx?.chainId) throw new Error('Invalid swap output: missing swapTx.chainId')
      if (!data.swapData?.sellAsset?.chainId) throw new Error('Invalid swap output: missing swapData.sellAsset.chainId')

      const sellAssetChainId = data.swapData.sellAsset.chainId
      const { chainNamespace, chainReference } = fromChainId(sellAssetChainId)

      const currentAddress = chainNamespace === CHAIN_NAMESPACE.Evm
        ? ctx.refs.evmAddress.current
        : ctx.refs.solanaAddress.current
      if (!currentAddress) throw new Error('Wallet disconnected. Please reconnect and try again.')
      if (currentAddress.toLowerCase() !== swapTx.from.toLowerCase()) {
        throw new Error('Wallet address changed. Please re-initiate the swap.')
      }

      let solanaSigner: SolanaWalletSigner | undefined
      if (chainNamespace === CHAIN_NAMESPACE.Solana && ctx.refs.solanaWallet.current) {
        solanaSigner = await ctx.refs.solanaWallet.current.getSigner()
      }

      // Step 0: Quote complete
      ctx.setState(draft => {
        draft.toolOutput = data
        draft.meta.networkName = data.swapData.sellAsset.network
      })
      ctx.advanceStep()

      // Step 1: Network switch
      await switchNetworkStep(ctx, sellAssetChainId)

      // Step 2: Approve (skip if not needed)
      if (needsApproval && approvalTx) {
        const approvalTxHash = await executeApproval(approvalTx, { solanaSigner })
        ctx.setMeta({ approvalTxHash } as Partial<SwapMeta>)

        if (chainNamespace === CHAIN_NAMESPACE.Evm) {
          await waitForConfirmedReceipt(Number(chainReference), approvalTxHash as `0x${string}`)
        }
        ctx.advanceStep()
      } else {
        ctx.skipStep()
      }

      // Step 3: Swap
      const swapTxHash = await executeSwap(swapTx, { solanaSigner })
      ctx.setMeta({ swapTxHash } as Partial<SwapMeta>)
      ctx.advanceStep()
      ctx.markTerminal()
      ctx.persist()

      analytics.trackSwap({
        sellAsset: data.swapData.sellAsset.symbol,
        buyAsset: data.swapData.buyAsset.symbol,
        sellAmount: data.swapData.sellAmountCryptoPrecision,
        buyAmount: data.swapData.buyAmountCryptoPrecision,
        network: data.swapData.sellAsset.network,
      })

      toast.success(
        <span>
          Your swap of{' '}
          <Amount.Crypto value={data.swapData.sellAmountCryptoPrecision} symbol={data.swapData.sellAsset.symbol.toUpperCase()} decimals={6} className="font-bold" />{' '}
          to{' '}
          <Amount.Crypto value={data.swapData.buyAmountCryptoPrecision} symbol={data.swapData.buyAsset.symbol.toUpperCase()} decimals={6} className="font-bold" />{' '}
          is complete
        </span>
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      ctx.setState(draft => {
        draft.error = errorMessage
        draft.failedStep = draft.currentStep
        draft.terminal = true
      })
      ctx.persist()

      toast.error(
        <span>
          Your swap of{' '}
          <Amount.Crypto value={data.swapData.sellAmountCryptoPrecision} symbol={data.swapData.sellAsset.symbol.toUpperCase()} decimals={6} className="font-bold" />{' '}
          to{' '}
          <Amount.Crypto value={data.swapData.buyAmountCryptoPrecision} symbol={data.swapData.buyAsset.symbol.toUpperCase()} decimals={6} className="font-bold" />{' '}
          failed
        </span>
      )
    }
  })

  const quoteStepStatus = (() => {
    if (toolState === 'output-error') return StepStatus.FAILED
    if (toolState === 'input-streaming' || toolState === 'input-available') return StepStatus.IN_PROGRESS
    if (toolState === 'output-available') return StepStatus.COMPLETE
    return StepStatus.NOT_STARTED
  })()

  return {
    state: ctx.state,
    steps: [
      { step: SWAP_STEPS.QUOTE, status: quoteStepStatus },
      { step: SWAP_STEPS.NETWORK, status: getStepStatus(SWAP_STEPS.NETWORK, ctx.state) },
      { step: SWAP_STEPS.APPROVE, status: getStepStatus(SWAP_STEPS.APPROVE, ctx.state) },
      { step: SWAP_STEPS.SWAP, status: getStepStatus(SWAP_STEPS.SWAP, ctx.state) },
    ],
    networkName: swapData?.swapData?.sellAsset?.network,
    error: ctx.state.error,
    approvalTxHash: ctx.state.meta.approvalTxHash,
    swapTxHash: ctx.state.meta.swapTxHash,
  }
}
```

**Step 2: Update InitiateSwapUI.tsx to use new 4-step layout**

Key changes:
- Remove `StepStatus` import from useSwapExecution (use from stepUtils or executionState)
- Use `Execution.*` compound components OR update step destructuring to 4 steps
- Remove the 5-step stepper, replace with 4-step

For the first migration, update the UI to work with the new 4-step hook return. You can either adopt `Execution.*` components here or keep the existing `TxStepCard` pattern but with 4 steps. Adopting `Execution.*` is the design doc's intent — do that.

```tsx
// The key changes in InitiateSwapUI.tsx:
// 1. Import Execution from '@/components/Execution'
// 2. Import SWAP_STEPS from the hook
// 3. Remove step destructuring, use Execution.* instead
// 4. Use Execution.Root, HistoricalGuard, Stepper, Step, ErrorFooter

// Replace the stepper section:
<Execution.Root state={state} toolCallId={toolCallId}>
  <Execution.HistoricalGuard fallbackLabel="Swap">
    <TxStepCard.Root>
      {/* Keep existing header/details JSX unchanged */}
      <Execution.Stepper>
        <Execution.Step index={SWAP_STEPS.QUOTE} label="Getting swap quote" overrideStatus={quoteStepStatus} connectorBottom />
        <Execution.Step index={SWAP_STEPS.NETWORK} label={networkName ? `Switch to ${networkName}` : 'Switch network'} connectorTop connectorBottom />
        <Execution.Step index={SWAP_STEPS.APPROVE} label="Approve token spending" connectorTop connectorBottom />
        <Execution.Step index={SWAP_STEPS.SWAP} label="Sign swap transaction" connectorTop />
      </Execution.Stepper>
      <Execution.ErrorFooter />
    </TxStepCard.Root>
  </Execution.HistoricalGuard>
</Execution.Root>
```

The full UI component needs to be updated to:
- Get `state` from the hook result (the ToolExecutionState)
- Remove `isHistorical`/`getPersistedTransaction` calls (handled by Execution.HistoricalGuard)
- Remove manual completedCount calculation
- Remove manual footerMessage logic
- Use `quoteStepStatus` as an `overrideStatus` on the quote step (since quote status comes from toolState, not execution state)

**Step 3: Delete the old swapSerialization test (it tested the old toPersistedState/fromPersistedState which no longer exist)**

The serialization round-trip test is no longer needed because persisted state IS runtime state (same type, no conversion).

```bash
rm apps/agentic-chat/src/hooks/__tests__/swapSerialization.test.ts
```

**Step 4: Verify the app still compiles**

Run: `cd apps/agentic-chat && bun run build 2>&1 | head -50`
Expected: No type errors related to swap

**Step 5: Commit**

```bash
git add -A apps/agentic-chat/src/hooks/useSwapExecution.tsx apps/agentic-chat/src/components/tools/InitiateSwapUI.tsx
git rm apps/agentic-chat/src/hooks/__tests__/swapSerialization.test.ts
git commit -m "feat: migrate swap to compositional execution pattern (4 steps)"
```

---

### Task 8: Migrate useSendExecution

**Files:**
- Modify: `apps/agentic-chat/src/hooks/useSendExecution.ts`
- Modify: `apps/agentic-chat/src/components/tools/SendUI.tsx`
- Delete: `apps/agentic-chat/src/hooks/__tests__/sendSerialization.test.ts`

**Step 1: Rewrite useSendExecution.ts**

Same pattern as swap. 3 steps: Prepare, Network, Send.

Key changes:
- Use `useToolExecution<SendMeta>` + `useExecuteOnce`
- Use `switchNetworkStep`
- Remove `SendStep` enum, `SEND_PHASES`, `SendState`, serialization functions
- Export `SEND_STEPS = { PREPARE: 0, NETWORK: 1, SEND: 2 }`

Follow the exact same pattern as the swap migration in Task 7.

**Step 2: Update SendUI.tsx to use Execution.* components**

Same pattern as InitiateSwapUI — use `Execution.Root`, `HistoricalGuard`, `Stepper`, `Step`, `ErrorFooter`.

**Step 3: Delete sendSerialization.test.ts**

**Step 4: Verify build**

Run: `cd apps/agentic-chat && bun run build 2>&1 | head -50`

**Step 5: Commit**

```bash
git add -A apps/agentic-chat/src/hooks/useSendExecution.ts apps/agentic-chat/src/components/tools/SendUI.tsx
git rm apps/agentic-chat/src/hooks/__tests__/sendSerialization.test.ts
git commit -m "feat: migrate send to compositional execution pattern"
```

---

### Task 9: Migrate useVaultDepositExecution

**Files:**
- Modify: `apps/agentic-chat/src/hooks/useVaultDepositExecution.ts`
- Modify: `apps/agentic-chat/src/components/tools/VaultDepositUI.tsx`
- Delete: `apps/agentic-chat/src/hooks/__tests__/vaultSerialization.test.ts`

**Step 1: Rewrite useVaultDepositExecution.ts**

3 steps: Prepare, Network, Deposit. Use `useToolExecution<VaultDepositMeta>` + `useExecuteOnce` + `switchNetworkStepByChainIdNumber`.

Export `VAULT_DEPOSIT_STEPS = { PREPARE: 0, NETWORK: 1, DEPOSIT: 2 }`

**Step 2: Update VaultDepositUI.tsx with Execution.* components**

**Step 3: Delete vaultSerialization.test.ts**

Note: vaultSerialization.test.ts may test both deposit and withdraw. Check the file first — if it tests both, delete it after migrating both vault hooks (defer to Task 11). If it only tests deposit, delete now.

**Step 4: Verify build, commit**

```bash
git commit -m "feat: migrate vault deposit to compositional execution pattern"
```

---

### Task 10: Migrate useVaultWithdrawExecution

**Files:**
- Modify: `apps/agentic-chat/src/hooks/useVaultWithdrawExecution.ts`
- Modify: `apps/agentic-chat/src/components/tools/VaultWithdrawUI.tsx`

**Step 1: Rewrite useVaultWithdrawExecution.ts**

3 steps: Prepare, Network, Withdraw. Use `useToolExecution<VaultWithdrawMeta>` + `useExecuteOnce` + `switchNetworkStepByChainIdNumber` + `submitSafeTxStep`.

Export `VAULT_WITHDRAW_STEPS = { PREPARE: 0, NETWORK: 1, WITHDRAW: 2 }`

**Step 2: Update VaultWithdrawUI.tsx with Execution.* components**

**Step 3: Verify build, commit**

```bash
git commit -m "feat: migrate vault withdraw to compositional execution pattern"
```

---

### Task 11: Migrate useVaultWithdrawAllExecution

**Files:**
- Modify: `apps/agentic-chat/src/hooks/useVaultWithdrawAllExecution.ts`
- Modify: `apps/agentic-chat/src/components/tools/VaultWithdrawAllUI.tsx`

**Step 1: Rewrite useVaultWithdrawAllExecution.ts**

2 steps: Prepare, Execute. Use `useToolExecution<VaultWithdrawAllMeta>`. The `chainResults` live in `meta.chainResults`.

Export `VAULT_WITHDRAW_ALL_STEPS = { PREPARE: 0, WITHDRAW_CHAINS: 1 }`

**Step 2: Update VaultWithdrawAllUI.tsx with Execution.* components**

**Step 3: Now delete vaultSerialization.test.ts (if not already deleted)**

**Step 4: Verify build, commit**

```bash
git commit -m "feat: migrate vault withdraw all to compositional execution pattern"
```

---

### Task 12: Migrate useLimitOrderExecution

**Files:**
- Modify: `apps/agentic-chat/src/hooks/useLimitOrderExecution.tsx`
- Modify: `apps/agentic-chat/src/components/tools/LimitOrderUI.tsx`
- Delete: `apps/agentic-chat/src/hooks/__tests__/limitOrderSerialization.test.ts`

**Step 1: Rewrite useLimitOrderExecution.tsx**

5 steps (collapsed from 7): Prepare, Network, Approve, Sign, Submit.

Use `useToolExecution<LimitOrderMeta>` + `useExecuteOnce` + `switchNetworkStepByChainIdNumber` + `approveTokenStep` (for EVM approval) + `signEip712Step`.

Keep `submitSignedOrder` as a local helper (it's limit-order-specific).

Export `LIMIT_ORDER_STEPS = { PREPARE: 0, NETWORK: 1, APPROVE: 2, SIGN: 3, SUBMIT: 4 }`

**Step 2: Update LimitOrderUI.tsx with Execution.* components**

**Step 3: Delete limitOrderSerialization.test.ts**

**Step 4: Verify build, commit**

```bash
git commit -m "feat: migrate limit order to compositional execution pattern (5 steps)"
```

---

### Task 13: Migrate useCancelLimitOrderExecution

**Files:**
- Modify: `apps/agentic-chat/src/hooks/useCancelLimitOrderExecution.tsx`
- Modify: `apps/agentic-chat/src/components/tools/CancelLimitOrderUI.tsx`
- Delete: `apps/agentic-chat/src/hooks/__tests__/cancelLimitOrderSerialization.test.ts`

**Step 1: Rewrite useCancelLimitOrderExecution.tsx**

4 steps: Prepare, Network, Sign, Cancel.

Use `useToolExecution<CancelLimitOrderMeta>` + `useExecuteOnce` + `switchNetworkStepByChainIdNumber` + `signEip712Step`.

Keep `submitCancellation` as a local helper.

Export `CANCEL_LIMIT_ORDER_STEPS = { PREPARE: 0, NETWORK: 1, SIGN: 2, SUBMIT: 3 }`

**Step 2: Update CancelLimitOrderUI.tsx with Execution.* components**

**Step 3: Delete cancelLimitOrderSerialization.test.ts**

**Step 4: Verify build, commit**

```bash
git commit -m "feat: migrate cancel limit order to compositional execution pattern"
```

---

### Task 14: Migrate useConditionalOrderExecution + useStopLossExecution + useTwapExecution

**Files:**
- Modify: `apps/agentic-chat/src/hooks/useConditionalOrderExecution.tsx`
- Modify: `apps/agentic-chat/src/hooks/useStopLossExecution.tsx`
- Modify: `apps/agentic-chat/src/hooks/useTwapExecution.tsx`
- Modify: `apps/agentic-chat/src/components/tools/StopLossUI.tsx`
- Modify: `apps/agentic-chat/src/components/tools/TwapUI.tsx`
- Delete: `apps/agentic-chat/src/hooks/__tests__/stopLossSerialization.test.ts`
- Delete: `apps/agentic-chat/src/hooks/__tests__/twapSerialization.test.ts`

**Step 1: Rewrite useConditionalOrderExecution.tsx**

6 steps (collapsed from 10): Prepare, Network, Safe Check, Deposit, Approve, Submit.

Deposit + confirmation → single "Deposit" step.
Approval + confirmation → single "Approve" step.
Submit + confirm → single "Submit" step.

Use `useToolExecution<ConditionalOrderMeta>` + `useExecuteOnce` + `switchNetworkStepByChainIdNumber` + `submitSafeTxStep`.

Keep the config pattern (toolType, orderType, errorLabel, toOrderRecord, renderSuccessToast).

Export `CONDITIONAL_ORDER_STEPS = { PREPARE: 0, NETWORK: 1, SAFE_CHECK: 2, DEPOSIT: 3, APPROVE: 4, SUBMIT: 5 }`

**Step 2: Update useStopLossExecution.tsx and useTwapExecution.tsx wrappers**

These become simpler — just pass config to the updated `useConditionalOrderExecution`. Remove all serialization re-exports.

**Step 3: Update StopLossUI.tsx and TwapUI.tsx with Execution.* components (6 steps)**

**Step 4: Delete stopLossSerialization.test.ts and twapSerialization.test.ts**

**Step 5: Verify build, commit**

```bash
git commit -m "feat: migrate conditional order, stop-loss, TWAP to compositional pattern (6 steps)"
```

---

### Task 15: Migrate useCancelConditionalOrderExecution

**Files:**
- Modify: `apps/agentic-chat/src/hooks/useCancelConditionalOrderExecution.tsx`
- Modify: `apps/agentic-chat/src/components/tools/CancelConditionalOrderUI.tsx`
- Modify: `apps/agentic-chat/src/components/tools/CancelStopLossUI.tsx`
- Modify: `apps/agentic-chat/src/components/tools/CancelTwapUI.tsx`

**Step 1: Rewrite useCancelConditionalOrderExecution.tsx**

4 steps (collapsed from 5): Prepare, Network, Safe Check, Cancel.

Submit + confirm → single "Cancel" step (executeSafeTransaction already waits for confirmation).

Use `useToolExecution<CancelConditionalOrderMeta>` + `useExecuteOnce` + `switchNetworkStepByChainIdNumber` + `submitSafeTxStep`.

Export `CANCEL_CONDITIONAL_STEPS = { PREPARE: 0, NETWORK: 1, SUBMIT_CANCEL: 2, CONFIRM_TX: 3 }`

**Step 2: Update CancelConditionalOrderUI.tsx, CancelStopLossUI.tsx, CancelTwapUI.tsx**

**Step 3: Verify build, commit**

```bash
git commit -m "feat: migrate cancel conditional order to compositional pattern"
```

---

### Task 16: Update activityNormalizer

**Files:**
- Modify: `apps/agentic-chat/src/lib/activityNormalizer.ts`
- Modify: `apps/agentic-chat/src/lib/__tests__/activityNormalizer.test.ts`

**Step 1: Update activityNormalizer.ts**

Replace `PersistedToolState` import with `ToolExecutionState` import. Replace `as string` casts with typed meta access.

```typescript
// Key changes:
import type { ToolExecutionState, SwapMeta, SendMeta, LimitOrderMeta } from './executionState'

export function normalizeToActivityItem(tx: ToolExecutionState): ActivityItem | null { ... }

function normalizeSwapActivity(tx: ToolExecutionState<SwapMeta>): ActivityItem | null {
  const output = tx.toolOutput as InitiateSwapOutput | undefined
  const swapTxHash = tx.meta.swapTxHash  // typed, no cast
  const approvalTxHash = tx.meta.approvalTxHash  // typed, no cast
  // ... rest same
}

function normalizeSendActivity(tx: ToolExecutionState<SendMeta>): ActivityItem | null {
  const output = tx.toolOutput as SendOutput | undefined
  const sendTxHash = tx.meta.sendTxHash  // typed, no cast
  // ... rest same
}

function normalizeLimitOrderActivity(tx: ToolExecutionState<LimitOrderMeta>): ActivityItem | null {
  const output = tx.toolOutput as CreateLimitOrderOutput | undefined
  const orderId = tx.meta.orderId  // typed, no cast
  // ... rest same
}
```

**Step 2: Update activityNormalizer.test.ts**

Update test fixtures to use `ToolExecutionState` shape instead of `PersistedToolState`. Replace `phases: [...]` with `completedSteps: [...]`, `skippedSteps: []`, `currentStep`, `terminal`, `meta: { ... }`.

**Step 3: Run tests**

Run: `cd apps/agentic-chat && bun test src/lib/__tests__/activityNormalizer.test.ts`
Expected: All PASS

**Step 4: Commit**

```bash
git add apps/agentic-chat/src/lib/activityNormalizer.ts apps/agentic-chat/src/lib/__tests__/activityNormalizer.test.ts
git commit -m "feat: update activityNormalizer for ToolExecutionState with typed meta"
```

---

### Task 17: Clean up stepUtils — remove createStepPhaseMap and old getStepStatus

**Files:**
- Modify: `apps/agentic-chat/src/lib/stepUtils.ts`
- Modify: `apps/agentic-chat/src/lib/__tests__/stepUtils.test.ts`

**Step 1: Remove from stepUtils.ts:**
- `createStepPhaseMap` function (no longer imported anywhere)
- `StepState` interface (the `Set<Step>` version — replaced by number[])
- The old `getStepStatus` that takes `StepState<TStep>` (replaced by the one in executionState.ts)
- `mergeStepStatuses` (no longer needed — confirmation steps are collapsed)

Keep:
- `StepStatus` enum
- `getUserFriendlyError`
- `signTypedDataWithWallet`

**Step 2: Update stepUtils.test.ts**

Remove tests for `createStepPhaseMap` and the old `getStepStatus`. Those are now tested in `executionState.test.ts`. Keep `getUserFriendlyError` tests if they exist (they don't currently — that's fine).

**Step 3: Search for any remaining imports of removed functions**

Run: `grep -r "createStepPhaseMap\|mergeStepStatuses\|StepState" apps/agentic-chat/src/ --include="*.ts" --include="*.tsx"`
Expected: No results (all migrated in Tasks 7-15)

**Step 4: Run all tests**

Run: `cd apps/agentic-chat && bun test`
Expected: All PASS

**Step 5: Commit**

```bash
git add apps/agentic-chat/src/lib/stepUtils.ts apps/agentic-chat/src/lib/__tests__/stepUtils.test.ts
git commit -m "chore: remove createStepPhaseMap, mergeStepStatuses, old getStepStatus from stepUtils"
```

---

### Task 18: Remove PersistedToolState alias and clean up chatStore

**Files:**
- Modify: `apps/agentic-chat/src/stores/chatStore.ts`

**Step 1: Search for remaining PersistedToolState imports**

Run: `grep -r "PersistedToolState" apps/agentic-chat/src/ --include="*.ts" --include="*.tsx"`

If any remain, update them to import `ToolExecutionState` from `@/lib/executionState` instead.

**Step 2: Remove the `PersistedToolState` type alias from chatStore.ts**

Also remove the `ToolOutput` union type from chatStore (it's now in executionState.ts). Remove the agentic-server imports that were only used for the ToolOutput union.

**Step 3: Verify build**

Run: `cd apps/agentic-chat && bun run build 2>&1 | head -50`

**Step 4: Run all tests**

Run: `cd apps/agentic-chat && bun test`

**Step 5: Commit**

```bash
git add apps/agentic-chat/src/stores/chatStore.ts
git commit -m "chore: remove PersistedToolState alias, clean up chatStore imports"
```

---

### Task 19: Delete useToolExecutionEffect (replaced by useExecuteOnce)

**Files:**
- Delete: `apps/agentic-chat/src/hooks/useToolExecutionEffect.ts`

**Step 1: Verify no remaining imports**

Run: `grep -r "useToolExecutionEffect" apps/agentic-chat/src/ --include="*.ts" --include="*.tsx"`
Expected: Only the file itself (or nothing if already unused)

**Step 2: Delete the file**

```bash
git rm apps/agentic-chat/src/hooks/useToolExecutionEffect.ts
```

**Step 3: Verify build and tests**

Run: `cd apps/agentic-chat && bun run build 2>&1 | head -50 && bun test`

**Step 4: Commit**

```bash
git commit -m "chore: remove useToolExecutionEffect (replaced by useExecuteOnce)"
```

---

### Task 20: Write new integration tests

**Files:**
- Create: `apps/agentic-chat/src/lib/__tests__/executionState.test.ts` (already created in Task 1, but expand)

**Step 1: Add getStepStatus edge case tests to executionState.test.ts**

Expand the test file from Task 1 with additional edge cases that cover the new number[]-based state:

```typescript
describe('getStepStatus edge cases', () => {
  it('returns SKIPPED for step in skippedSteps even if past', () => {
    const state = makeState({ currentStep: 3, skippedSteps: [1], completedSteps: [0, 2] })
    expect(getStepStatus(1, state)).toBe(StepStatus.SKIPPED)
  })

  it('handles empty completedSteps and skippedSteps', () => {
    const state = makeState({ currentStep: 0 })
    expect(getStepStatus(0, state)).toBe(StepStatus.IN_PROGRESS)
    expect(getStepStatus(1, state)).toBe(StepStatus.NOT_STARTED)
  })

  it('handles terminal state with error', () => {
    const state = makeState({ currentStep: 2, failedStep: 2, error: 'fail', terminal: true, completedSteps: [0, 1] })
    expect(getStepStatus(0, state)).toBe(StepStatus.COMPLETE)
    expect(getStepStatus(1, state)).toBe(StepStatus.COMPLETE)
    expect(getStepStatus(2, state)).toBe(StepStatus.FAILED)
    expect(getStepStatus(3, state)).toBe(StepStatus.NOT_STARTED)
  })
})
```

**Step 2: Run tests**

Run: `cd apps/agentic-chat && bun test src/lib/__tests__/executionState.test.ts`
Expected: All PASS

**Step 3: Commit**

```bash
git add apps/agentic-chat/src/lib/__tests__/executionState.test.ts
git commit -m "test: expand executionState tests with edge cases"
```

---

### Task 21: Final verification

**Step 1: Run full test suite**

Run: `cd apps/agentic-chat && bun test`
Expected: All PASS

**Step 2: Run build**

Run: `cd apps/agentic-chat && bun run build`
Expected: Clean build, no errors

**Step 3: Search for dead code**

Run: `grep -r "createStepPhaseMap\|fromPersistedState\|toPersistedState\|persistedStateTo\|StateToPersistedState\|PHASES\b" apps/agentic-chat/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v __tests__`
Expected: No results (all old serialization code removed)

**Step 4: Verify no remaining Set<Step> patterns**

Run: `grep -r "Set<.*Step>" apps/agentic-chat/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules`
Expected: No results (all replaced with number[])

**Step 5: Commit (if any final fixes were needed)**

```bash
git commit -m "chore: final cleanup after tool execution unification"
```

**2026-03-09T07:46:26Z**

Tasks 1-7 complete: Foundation (executionState types, chatStore v3, useToolExecution, useExecuteOnce, shared steps, Execution.* UI) + swap migration to 4-step compositional pattern

**2026-03-09T08:04:19Z**

Tasks 8-15 complete: All 9 per-tool migrations done (send, vault deposit/withdraw/withdrawAll, limit order, cancel limit order, conditional order/stop-loss/TWAP, cancel conditional)

**2026-03-09T08:14:40Z**

Tasks 16-21 complete: activityNormalizer updated, dead code removed, tests expanded, final verification passed (113 tests, 0 failures, all dead code checks clean)
