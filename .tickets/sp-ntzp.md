---
id: sp-ntzp
status: closed
deps: []
links: []
created: 2026-03-11T23:23:03Z
type: chore
priority: 2
assignee: Jibles
---
# Consolidate tool enumerations into central registries

# Consolidate Tool Enumerations Into Central Registries

## Objective

Reduce the number of files touched when adding a new tool. Currently requires 7-10 manual edits across 4+ files because tool names, output types, and metadata are enumerated independently. Goal: enumerate once in a central location, derive everything else.

## Architecture

### 1. Central Registry (toolOutput.ts)

`ToolOutputMap` is the single source of truth for tool name → output type. `ToolName = keyof ToolOutputMap` is the universal tool identifier.

**Delete from executionState.ts:**
- `ToolType` union (12 hand-maintained entries) — replaced by `ToolName`
- `ToolOutput` union (11 hand-maintained entries) — replaced by `ToolOutputMap[ToolName]`

All code that references `ToolType` switches to `ToolName`. The persisted `toolType` field becomes `toolName` storing values like `'initiateSwapTool'` instead of `'swap'`. No migration needed (beta).

### 2. txHash Normalization

Rename all per-tool hash fields to `txHash` as the primary field. Two named exceptions stay: `approvalTxHash` (genuine second tx) and `depositTxHash` (distinct Safe deposit tx).

Before → After:
- `SwapMeta { swapTxHash, approvalTxHash }` → `{ txHash, approvalTxHash }`
- `SendMeta { sendTxHash }` → `{ txHash }`
- `LimitOrderMeta { submitTxHash, approvalTxHash }` → `{ txHash, approvalTxHash }`
- `ConditionalOrderMeta { submitTxHash, approvalTxHash, depositTxHash }` → `{ txHash, approvalTxHash, depositTxHash }`
- `CancelConditionalOrderMeta { cancelTxHash }` → `{ txHash }`
- `VaultDepositMeta { depositTxHash }` → `{ txHash }`
- `VaultWithdrawMeta { withdrawTxHash }` → `{ txHash }`

Update all execution hooks: useSwapExecution, SendUI, useLimitOrderExecution, useConditionalOrderExecution, useCancelConditionalOrderExecution, VaultDepositUI, VaultWithdrawUI. Update activityNormalizer.ts to read meta.txHash. No migration (beta).

### 3. CoW Network Schema

Extract `z.enum(['ethereum', 'gnosis', 'arbitrum'])` to `apps/agentic-server/src/lib/cow/types.ts`:

```ts
export const cowSupportedNetworkSchema = z.enum(['ethereum', 'gnosis', 'arbitrum'])
```

All 7 tool files import from there: createLimitOrder.ts, createStopLoss.ts, cancelStopLoss.ts, createTwap.ts, cancelTwap.ts, vaultDeposit.ts, vaultWithdraw.ts.

### 4. buildTools() Deduplication (Composition)

Replace verbose `toolName: wrapTool('toolName', tool, ctx)` with a batch `wrapTools()` that reads names from object keys:

```ts
function wrapTools(tools: Record<string, Tool>, walletContext?: WalletContext) {
  return Object.fromEntries(
    Object.entries(tools).map(([name, tool]) => [name, wrapTool(name, tool, walletContext)])
  )
}

function buildTools(walletContext: WalletContext) {
  return {
    ...wrapTools({ getAssetsTool, getAssetPricesTool, switchNetworkTool, ... }),
    ...wrapTools({ sendTool, portfolioTool, initiateSwapTool, ... }, walletContext),
    // getAllowanceTool composed directly — no framework needed
    getAllowanceTool: {
      description: getAllowanceTool.description,
      inputSchema: getAllowanceTool.inputSchema,
      execute: async (args) => { /* custom address resolution */ },
    },
  }
}
```

No registry array, no config flags. One-offs compose directly at the call site.

### 5. Display Names

Add `displayName` to `toolUIRegistry.tsx` (already maps every tool to its UI component):

```ts
const TOOL_UI_REGISTRY: Record<ToolName, { component: ComponentType<...> | null; displayName: string }> = {
  sendTool: { component: SendUI, displayName: 'Send' },
  initiateSwapTool: { component: InitiateSwapUI, displayName: 'Swap' },
  ...
}

export function getToolDisplayName(toolName: ToolName): string {
  return TOOL_UI_REGISTRY[toolName].displayName
}
```

Activity normalizer, ActivityRow, and mixpanel read from getToolDisplayName() instead of hardcoding.

### 6. index.ts Barrel Exports

Leave as-is. Verbose but serves as explicit public API contract. Wildcard re-exports would leak internals.

## Files to Modify

**Frontend (agentic-chat):**
- `src/types/toolOutput.ts` — no changes, already the source of truth
- `src/lib/executionState.ts` — delete ToolType/ToolOutput unions, rename txHash fields in Meta interfaces, rename toolType→toolName in ToolExecutionState
- `src/components/toolUIRegistry.tsx` — add displayName field and getToolDisplayName()
- `src/lib/activityNormalizer.ts` — use ToolName instead of ToolType, read meta.txHash
- `src/components/Portfolio/ActivityRow/ActivityRow.tsx` — use ToolName, read displayName from registry
- `src/lib/mixpanel.ts` — use getToolDisplayName()
- `src/types/activity.ts` — update discriminated union to use ToolName
- `src/stores/chatStore.ts` — update ToolExecutionState references if needed
- `src/components/tools/useSwapExecution.tsx` — swapTxHash → txHash
- `src/components/tools/SendUI.tsx` — sendTxHash → txHash
- `src/components/tools/useLimitOrderExecution.tsx` — submitTxHash → txHash
- `src/components/tools/useConditionalOrderExecution.tsx` — submitTxHash → txHash
- `src/components/tools/useCancelConditionalOrderExecution.tsx` — cancelTxHash → txHash
- `src/components/tools/VaultDepositUI.tsx` — depositTxHash → txHash
- `src/components/tools/VaultWithdrawUI.tsx` — withdrawTxHash → txHash
- `src/components/Portfolio/ActivityList.tsx` — update filter to use ToolName
- `src/lib/__tests__/activityNormalizer.test.ts` — update test fixtures

**Server (agentic-server):**
- `src/routes/chat.ts` — refactor buildTools() with wrapTools()
- `src/lib/cow/types.ts` — add cowSupportedNetworkSchema
- `src/tools/limitOrder/createLimitOrder.ts` — import cowSupportedNetworkSchema
- `src/tools/stopLoss/createStopLoss.ts` — import cowSupportedNetworkSchema
- `src/tools/stopLoss/cancelStopLoss.ts` — import cowSupportedNetworkSchema
- `src/tools/twap/createTwap.ts` — import cowSupportedNetworkSchema
- `src/tools/twap/cancelTwap.ts` — import cowSupportedNetworkSchema
- `src/tools/vault/vaultDeposit.ts` — import cowSupportedNetworkSchema
- `src/tools/vault/vaultWithdraw.ts` — import cowSupportedNetworkSchema

## Acceptance Criteria

- [ ] ToolType and ToolOutput unions deleted from executionState.ts; all usages replaced with ToolName and ToolOutputMap[ToolName]
- [ ] All tools use meta.txHash as primary field (approvalTxHash and depositTxHash kept as named exceptions)
- [ ] CoW network schema defined once in cow/types.ts, imported by all 7 tool files
- [ ] buildTools() uses wrapTools() batch helper; name duplication eliminated
- [ ] toolUIRegistry.tsx has displayName for every tool; getToolDisplayName() exported
- [ ] Activity system and analytics use getToolDisplayName() instead of hardcoded strings
- [ ] Lint and type-check pass
- [ ] Existing tests updated and passing

## Gotchas

- ToolExecutionState.toolType field rename to toolName — grep for all usages, there are many
- activityNormalizer switch/case must update from 'swap'/'send'/'limit_order' to ToolName values
- The activity system's discriminated union in activity.ts uses the type field — must align with new ToolName values
- toolUIRegistry.tsx component type will need updating since it now holds an object instead of just a ComponentType
- getAllowanceTool in buildTools() has custom address resolution — composed directly, not through wrapTools()
- VaultWithdrawAllMeta uses chainResults[] not a single txHash — leave it as-is

## Notes

**2026-03-11T23:27:38Z**

# Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use /run tk:sp-ntzp to implement this plan task-by-task via subagent-driven-development.

**Goal:** Consolidate tool enumerations so adding a new tool requires editing fewer files.

**Architecture:** Central registry (`ToolOutputMap`/`ToolName` in `toolOutput.ts`) becomes the single source of truth. `ToolType`/`ToolOutput` unions deleted. Per-tool hash fields normalized to `txHash`. CoW network enum extracted. `buildTools()` uses batch helper.

**Tech Stack:** TypeScript, React, Zod, Zustand, Hono

---

### Task 1: Extract CoW Network Schema

**Files:**
- Modify: `apps/agentic-server/src/lib/cow/types.ts`
- Modify: `apps/agentic-server/src/tools/limitOrder/createLimitOrder.ts:21`
- Modify: `apps/agentic-server/src/tools/stopLoss/createStopLoss.ts:43`
- Modify: `apps/agentic-server/src/tools/stopLoss/cancelStopLoss.ts:12`
- Modify: `apps/agentic-server/src/tools/twap/createTwap.ts:38`
- Modify: `apps/agentic-server/src/tools/twap/cancelTwap.ts:12`
- Modify: `apps/agentic-server/src/tools/vault/vaultDeposit.ts:18`
- Modify: `apps/agentic-server/src/tools/vault/vaultWithdraw.ts:16`

**Step 1: Add cowSupportedNetworkSchema to cow/types.ts**

Add this import and export at the top of `apps/agentic-server/src/lib/cow/types.ts`:

```ts
import { z } from 'zod'

export const cowSupportedNetworkSchema = z.enum(['ethereum', 'gnosis', 'arbitrum'])
```

**Step 2: Update all 7 tool files to import from cow/types.ts**

In each file, replace the inline `z.enum(['ethereum', 'gnosis', 'arbitrum'])` with `cowSupportedNetworkSchema`. Add the import:

```ts
import { cowSupportedNetworkSchema } from '../../lib/cow/types'
```

For `createLimitOrder.ts`:
```ts
// Before:
network: z.enum(['ethereum', 'gnosis', 'arbitrum']).describe('Network for the limit order'),
// After:
network: cowSupportedNetworkSchema.describe('Network for the limit order'),
```

Repeat for all 7 files, keeping each file's `.describe()` text intact.

**Step 3: Verify type-check passes**

Run: `cd apps/agentic-server && bunx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add apps/agentic-server/src/lib/cow/types.ts apps/agentic-server/src/tools/limitOrder/createLimitOrder.ts apps/agentic-server/src/tools/stopLoss/createStopLoss.ts apps/agentic-server/src/tools/stopLoss/cancelStopLoss.ts apps/agentic-server/src/tools/twap/createTwap.ts apps/agentic-server/src/tools/twap/cancelTwap.ts apps/agentic-server/src/tools/vault/vaultDeposit.ts apps/agentic-server/src/tools/vault/vaultWithdraw.ts
git commit -m "refactor: extract cowSupportedNetworkSchema to cow/types.ts"
```

---

### Task 2: Add wrapTools() Batch Helper to buildTools()

**Files:**
- Modify: `apps/agentic-server/src/routes/chat.ts:57-166`

**Step 1: Add wrapTools() helper function**

Add below the existing `wrapTool()` function in `chat.ts`:

```ts
function wrapTools(
  tools: Record<string, { description: string; inputSchema: unknown; execute: (...args: never[]) => unknown }>,
  walletContext?: WalletContext
) {
  return Object.fromEntries(
    Object.entries(tools).map(([name, tool]) => [name, wrapTool(name, tool, walletContext)])
  )
}
```

**Step 2: Refactor buildTools() to use wrapTools()**

Replace `buildTools()` body with:

```ts
function buildTools(walletContext: WalletContext) {
  return {
    ...wrapTools({
      mathCalculatorTool: mathCalculator,
      getAssetsTool,
      getAssetPricesTool,
      lookupExternalAddress: lookupExternalAddressTool,
      switchNetworkTool,
      getShapeShiftKnowledgeTool,
      getPriceFeedTokensTool,
      getTrendingTokensTool,
      getTopGainersLosersTool,
      getTrendingPoolsTool,
      getCategoriesTool,
      getNewCoinsTool,
    }),
    ...wrapTools(
      {
        checkWalletCapabilitiesTool,
        transactionHistoryTool,
        portfolioTool,
        initiateSwapTool,
        initiateSwapUsdTool,
        sendTool,
        receiveTool,
        createLimitOrderTool,
        getLimitOrdersTool,
        cancelLimitOrderTool,
        createStopLossTool,
        getStopLossOrdersTool,
        cancelStopLossTool,
        createTwapTool,
        getTwapOrdersTool,
        cancelTwapTool,
        vaultBalanceTool,
        vaultDepositTool,
        vaultWithdrawTool,
        vaultWithdrawAllTool,
      },
      walletContext
    ),
    getAllowanceTool: {
      description: getAllowanceTool.description,
      inputSchema: getAllowanceTool.inputSchema,
      execute: async (args: Parameters<typeof getAllowanceTool.execute>[0]) => {
        console.log('[Tool] getAllowanceTool:', JSON.stringify(args, null, 2))
        const chainId = args?.asset?.chainId
        const from = args?.from ?? (chainId ? walletContext.connectedWallets?.[chainId]?.address : undefined)
        if (!from) {
          throw new Error('Missing `from` address. Connect a wallet or specify `from`.')
        }
        return getAllowanceTool.execute({ ...args, from })
      },
    },
  }
}
```

Note: The tools that share the same variable name and key (like `getAssetsTool`) use shorthand property syntax. `mathCalculatorTool: mathCalculator` keeps the key name but uses the differently-named import. `lookupExternalAddress: lookupExternalAddressTool` likewise maps the key to the import.

**Step 3: Verify type-check passes**

Run: `cd apps/agentic-server && bunx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add apps/agentic-server/src/routes/chat.ts
git commit -m "refactor: deduplicate buildTools() with wrapTools() batch helper"
```

---

### Task 3: Delete ToolType/ToolOutput, Rename toolType→toolName and Hash Fields

**Files:**
- Modify: `apps/agentic-chat/src/lib/executionState.ts`
- Test: `apps/agentic-chat/src/lib/__tests__/executionState.test.ts`

**Step 1: Write the failing test**

Update `apps/agentic-chat/src/lib/__tests__/executionState.test.ts` — change the `makeState` helper to use `toolName` instead of `toolType`:

```ts
function makeState(overrides: Partial<ToolExecutionState> = {}): ToolExecutionState {
  return {
    toolCallId: 'tc-1',
    toolName: 'initiateSwapTool',
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
```

Also remove the `ToolType` import if it was imported (it's not in this test, but verify).

**Step 2: Run test to verify it fails**

Run: `cd apps/agentic-chat && bun test src/lib/__tests__/executionState.test.ts`
Expected: FAIL — `toolName` does not exist on `ToolExecutionState`

**Step 3: Implement changes in executionState.ts**

In `apps/agentic-chat/src/lib/executionState.ts`:

1. Remove the entire `ToolType` union (lines 17-29)
2. Remove the entire `ToolOutput` union (lines 31-42)
3. Remove the imports that were only used by `ToolOutput` (lines 1-13) — keep only `StepStatus` import
4. Add import: `import type { ToolName } from '@/types/toolOutput'`
5. In `ToolExecutionState`, rename `toolType: ToolType` → `toolName: ToolName` and `toolOutput?: ToolOutput` → `toolOutput?: unknown`
6. Rename Meta hash fields:
   - `SwapMeta`: `swapTxHash` → `txHash`
   - `SendMeta`: `sendTxHash` → `txHash`
   - `LimitOrderMeta`: `submitTxHash` → `txHash`
   - `ConditionalOrderMeta`: `submitTxHash` → `txHash`
   - `CancelConditionalOrderMeta`: `cancelTxHash` → `txHash`
   - `VaultDepositMeta`: `depositTxHash` → `txHash`
   - `VaultWithdrawMeta`: `withdrawTxHash` → `txHash`

The resulting file:

```ts
import type { ToolName } from '@/types/toolOutput'

import { StepStatus } from './stepUtils'

export interface ToolExecutionState<TMeta = unknown> {
  toolCallId: string
  toolName: ToolName
  conversationId: string
  timestamp: number
  walletAddress?: string
  toolOutput?: unknown

  currentStep: number
  completedSteps: number[]
  skippedSteps: number[]
  failedStep?: number
  error?: string
  terminal: boolean

  meta: TMeta
}

export interface SwapMeta {
  approvalTxHash?: string
  txHash?: string
  networkName?: string
}

export interface SendMeta {
  txHash?: string
  networkName?: string
}

export interface LimitOrderMeta {
  orderId?: string
  txHash?: string
  approvalTxHash?: string
  networkName?: string
}

export interface ConditionalOrderMeta {
  approvalTxHash?: string
  depositTxHash?: string
  txHash?: string
  orderId?: string
  networkName?: string
}

export interface CancelLimitOrderMeta {
  orderId?: string
  networkName?: string
}

export interface CancelConditionalOrderMeta {
  txHash?: string
}

export interface VaultDepositMeta {
  txHash?: string
  networkName?: string
}

export interface VaultWithdrawMeta {
  txHash?: string
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
```

Keep all the functions (`advanceStep`, `failStep`, `skipStep`, `markTerminal`, `toolStateToStepStatus`, `getStepStatus`) unchanged.

**Step 4: Run test to verify it passes**

Run: `cd apps/agentic-chat && bun test src/lib/__tests__/executionState.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/agentic-chat/src/lib/executionState.ts apps/agentic-chat/src/lib/__tests__/executionState.test.ts
git commit -m "refactor: delete ToolType/ToolOutput, rename toolType→toolName, normalize txHash"
```

---

### Task 4: Update useToolExecution Hook

**Files:**
- Modify: `apps/agentic-chat/src/hooks/useToolExecution.ts`

**Step 1: Update the hook signature**

In `apps/agentic-chat/src/hooks/useToolExecution.ts`:

1. Change import from `import type { ToolExecutionState, ToolType } from '@/lib/executionState'` to `import type { ToolExecutionState } from '@/lib/executionState'`
2. Add import: `import type { ToolName } from '@/types/toolOutput'`
3. Change parameter: `toolType: ToolType` → `toolName: ToolName`
4. In the `initialState` object, change `toolType,` → `toolName,`

**Step 2: Verify type-check passes**

Run: `cd apps/agentic-chat && bunx tsc --noEmit 2>&1 | head -50`
Expected: Errors in downstream files (tool UIs still pass old values) — but useToolExecution.ts itself should be correct. This is expected; we fix downstream in the next task.

**Step 3: Commit**

```bash
git add apps/agentic-chat/src/hooks/useToolExecution.ts
git commit -m "refactor: useToolExecution takes ToolName instead of ToolType"
```

---

### Task 5: Update All Tool UI Components

**Files:**
- Modify: `apps/agentic-chat/src/components/tools/useSwapExecution.tsx`
- Modify: `apps/agentic-chat/src/components/tools/SendUI.tsx`
- Modify: `apps/agentic-chat/src/components/tools/useLimitOrderExecution.tsx`
- Modify: `apps/agentic-chat/src/components/tools/useConditionalOrderExecution.tsx`
- Modify: `apps/agentic-chat/src/components/tools/useCancelConditionalOrderExecution.tsx`
- Modify: `apps/agentic-chat/src/components/tools/VaultDepositUI.tsx`
- Modify: `apps/agentic-chat/src/components/tools/VaultWithdrawUI.tsx`
- Modify: `apps/agentic-chat/src/components/tools/StopLossUI.tsx`
- Modify: `apps/agentic-chat/src/components/tools/TwapUI.tsx`
- Modify: `apps/agentic-chat/src/components/tools/CancelStopLossUI.tsx`
- Modify: `apps/agentic-chat/src/components/tools/CancelTwapUI.tsx`

Each file needs two kinds of changes:
1. **useToolExecution call**: Change the second argument from old ToolType string to ToolName string
2. **Hash field renames**: Update any references to renamed hash fields

Here are the changes for each file:

**useSwapExecution.tsx:**
- `useToolExecution<SwapMeta>(toolCallId, 'swap', {})` → `useToolExecution<SwapMeta>(toolCallId, 'initiateSwapTool', {})`
- `ctx.setMeta({ swapTxHash })` → `ctx.setMeta({ txHash: swapTxHash })` (line 91 — keep the local variable name `swapTxHash` from `executeSwap`, just map it)
- Return: `swapTxHash: ctx.state.meta.swapTxHash` → `swapTxHash: ctx.state.meta.txHash`

**SendUI.tsx:**
- `useToolExecution<SendMeta>(toolCallId, 'send', {})` → `useToolExecution<SendMeta>(toolCallId, 'sendTool', {})`
- `ctx.setMeta({ sendTxHash })` → `ctx.setMeta({ txHash: sendTxHash })`

**useLimitOrderExecution.tsx:**
- `useToolExecution<LimitOrderMeta>(toolCallId, 'limit_order', {})` → `useToolExecution<LimitOrderMeta>(toolCallId, 'createLimitOrderTool', {})`
- No hash field changes needed — `LimitOrderMeta` doesn't have `submitTxHash` used in this file (it stores `orderId` and `approvalTxHash` which stay the same). Wait, checking the file... Line 120: `ctx.setMeta({ approvalTxHash } as Partial<LimitOrderMeta>)` — approvalTxHash stays. And the `orderId` stays. The `submitTxHash` in `LimitOrderMeta` was renamed to `txHash`, but limit orders don't set submitTxHash in this file — they just set `orderId`. So no hash changes needed here.

**useConditionalOrderExecution.tsx:**
- Line 44: `toolType: ToolExecutionState<ConditionalOrderMeta>['toolType']` → `toolName: ToolExecutionState<ConditionalOrderMeta>['toolName']`
- Line 131: `useToolExecution<ConditionalOrderMeta>(toolCallId, config.toolType, {})` → `useToolExecution<ConditionalOrderMeta>(toolCallId, config.toolName, {})`
- Line 94: `ctx.setMeta({ depositTxHash } as Partial<ConditionalOrderMeta>)` — `depositTxHash` stays (named exception)
- Line 121: `ctx.setMeta({ approvalTxHash } as Partial<ConditionalOrderMeta>)` — stays
- Line 173: `ctx.setMeta({ submitTxHash } as Partial<ConditionalOrderMeta>)` → `ctx.setMeta({ txHash: submitTxHash } as Partial<ConditionalOrderMeta>)` (submitTxHash was renamed to txHash in ConditionalOrderMeta)
- Line 213: `submitTxHash: ctx.state.meta.submitTxHash` → `submitTxHash: ctx.state.meta.txHash`

**useCancelConditionalOrderExecution.tsx:**
- Line 25: `toolType: 'cancel_stop_loss' | 'cancel_twap'` → `toolName: 'cancelStopLossTool' | 'cancelTwapTool'`
- Line 51: `useToolExecution<CancelConditionalOrderMeta>(toolCallId, config.toolType, {})` → `useToolExecution<CancelConditionalOrderMeta>(toolCallId, config.toolName, {})`
- Line 76: `ctx.setMeta({ cancelTxHash } as Partial<CancelConditionalOrderMeta>)` → `ctx.setMeta({ txHash: cancelTxHash } as Partial<CancelConditionalOrderMeta>)`
- Line 84: `if (config.toolType === 'cancel_stop_loss')` → `if (config.toolName === 'cancelStopLossTool')`
- Line 121: `cancelTxHash: ctx.state.meta.cancelTxHash` → `cancelTxHash: ctx.state.meta.txHash`

**VaultDepositUI.tsx:**
- `useToolExecution<VaultDepositMeta>(toolCallId, 'vault_deposit', {})` → `useToolExecution<VaultDepositMeta>(toolCallId, 'vaultDepositTool', {})`
- `ctx.setMeta({ depositTxHash })` → `ctx.setMeta({ txHash: depositTxHash })`

**VaultWithdrawUI.tsx:**
- `useToolExecution<VaultWithdrawMeta>(toolCallId, 'vault_withdraw', {})` → `useToolExecution<VaultWithdrawMeta>(toolCallId, 'vaultWithdrawTool', {})`
- `ctx.setMeta({ withdrawTxHash })` → `ctx.setMeta({ txHash: withdrawTxHash })`

**StopLossUI.tsx:**
- `toolType: 'stop_loss'` → `toolName: 'createStopLossTool'`

**TwapUI.tsx:**
- `toolType: 'twap'` → `toolName: 'createTwapTool'`

**CancelStopLossUI.tsx:**
- `toolType: 'cancel_stop_loss'` → `toolName: 'cancelStopLossTool'`

**CancelTwapUI.tsx:**
- `toolType: 'cancel_twap'` → `toolName: 'cancelTwapTool'`

**Step 1: Apply all changes above**

**Step 2: Verify type-check passes**

Run: `cd apps/agentic-chat && bunx tsc --noEmit 2>&1 | head -50`
Expected: Remaining errors only in activityNormalizer.ts and ActivityList.tsx (updated in next task)

**Step 3: Commit**

```bash
git add apps/agentic-chat/src/components/tools/
git commit -m "refactor: update tool UI components to use ToolName and normalized txHash"
```

---

### Task 6: Add displayName to toolUIRegistry

**Files:**
- Modify: `apps/agentic-chat/src/components/toolUIRegistry.tsx`

**Step 1: Add displayName field and export getter**

Update `toolUIRegistry.tsx`:

```ts
type ToolUIEntry<K extends ToolName> = {
  component: ComponentType<ToolUIComponentProps<K>> | null
  displayName: string
}

type ToolUIComponentMap = {
  [K in ToolName]: ToolUIEntry<K>
}

const TOOL_UI_REGISTRY: ToolUIComponentMap = {
  sendTool: { component: SendUI, displayName: 'Send' },
  initiateSwapTool: { component: InitiateSwapUI, displayName: 'Swap' },
  initiateSwapUsdTool: { component: InitiateSwapUI, displayName: 'Swap' },
  switchNetworkTool: { component: SwitchNetworkUI, displayName: 'Switch Network' },
  portfolioTool: { component: PortfolioUI, displayName: 'Portfolio' },
  getAssetsTool: { component: GetAssetsUI, displayName: 'Get Assets' },
  lookupExternalAddress: { component: GetAccountUI, displayName: 'Lookup Address' },
  transactionHistoryTool: { component: GetTransactionHistoryUI, displayName: 'Transaction History' },
  getAllowanceTool: { component: GetAllowanceUI, displayName: 'Get Allowance' },
  receiveTool: { component: ReceiveUI, displayName: 'Receive' },
  getTrendingTokensTool: { component: TrendingTokensUI, displayName: 'Trending Tokens' },
  getTopGainersLosersTool: { component: TopGainersLosersUI, displayName: 'Top Gainers & Losers' },
  getNewCoinsTool: { component: NewCoinsUI, displayName: 'New Coins' },
  createLimitOrderTool: { component: LimitOrderUI, displayName: 'Limit Order' },
  getLimitOrdersTool: { component: GetLimitOrdersUI, displayName: 'Limit Orders' },
  cancelLimitOrderTool: { component: CancelLimitOrderUI, displayName: 'Cancel Limit Order' },
  createStopLossTool: { component: StopLossUI, displayName: 'Stop Loss' },
  getStopLossOrdersTool: { component: GetStopLossOrdersUI, displayName: 'Stop Loss Orders' },
  cancelStopLossTool: { component: CancelStopLossUI, displayName: 'Cancel Stop Loss' },
  createTwapTool: { component: TwapUI, displayName: 'TWAP' },
  getTwapOrdersTool: { component: GetTwapOrdersUI, displayName: 'TWAP Orders' },
  cancelTwapTool: { component: CancelTwapUI, displayName: 'Cancel TWAP' },
  checkWalletCapabilitiesTool: { component: CheckWalletCapabilitiesUI, displayName: 'Wallet Capabilities' },
  vaultDepositTool: { component: VaultDepositUI, displayName: 'Vault Deposit' },
  vaultWithdrawTool: { component: VaultWithdrawUI, displayName: 'Vault Withdraw' },
  vaultWithdrawAllTool: { component: VaultWithdrawAllUI, displayName: 'Vault Withdraw All' },
  getAssetPricesTool: { component: null, displayName: 'Asset Prices' },
}
```

Wait — `getAssetPricesTool` is in `ToolOutputMap` but NOT in the current registry. Check if it needs to be added... Looking at current registry, it's not there. The `ToolUIComponentMap` type requires `[K in ToolName]`, so it must have an entry for every ToolName. Let me check...

Actually, looking at the current code, the type is `{ [K in ToolName]: ComponentType<...> | null }` — so it already requires all keys. But `getAssetPricesTool` isn't listed. Let me re-check... No wait, looking at the current TOOL_UI_REGISTRY, it doesn't have entries for `getAssetPricesTool`, `getAssetPricesTool` or `checkWalletCapabilitiesTool`... actually `checkWalletCapabilitiesTool` IS there on line 59.

Hmm, but `getAssetPricesTool` is NOT in the registry. How does this compile? Because `getAssetPricesTool` isn't in `ToolOutputMap`... let me recheck. Looking at `toolOutput.ts` — I don't see `getAssetPricesTool` there. So it's not a ToolName. Good.

OK so the registry already has entries for all ToolNames. The change is just restructuring from `ComponentType | null` to `{ component, displayName }`.

Update `getToolUIComponent`:

```ts
export function getToolUIComponent(toolName: string): ComponentType<ToolRendererProps> | null | undefined {
  const entry = TOOL_UI_REGISTRY[toolName as ToolName]
  return entry?.component as ComponentType<ToolRendererProps> | null | undefined
}

export function getToolDisplayName(toolName: string): string {
  return TOOL_UI_REGISTRY[toolName as ToolName]?.displayName ?? toolName
}
```

**Step 2: Verify type-check passes**

Run: `cd apps/agentic-chat && bunx tsc --noEmit 2>&1 | head -20`
Expected: Only remaining errors in activityNormalizer/ActivityList (next task)

**Step 3: Commit**

```bash
git add apps/agentic-chat/src/components/toolUIRegistry.tsx
git commit -m "feat: add displayName to toolUIRegistry with getToolDisplayName()"
```

---

### Task 7: Update Activity System

**Files:**
- Modify: `apps/agentic-chat/src/types/activity.ts`
- Modify: `apps/agentic-chat/src/lib/activityNormalizer.ts`
- Modify: `apps/agentic-chat/src/components/Portfolio/ActivityList.tsx`
- Modify: `apps/agentic-chat/src/components/Portfolio/ActivityRow/ActivityRow.tsx`
- Test: `apps/agentic-chat/src/lib/__tests__/activityNormalizer.test.ts`

**Step 1: Write the failing tests**

Update `activityNormalizer.test.ts` — change all `toolType` → `toolName` and update the values:

In `makeExecutionState`:
```ts
const makeExecutionState = (overrides: Partial<ToolExecutionState>): ToolExecutionState => ({
  toolCallId: 'tc-1',
  toolName: 'initiateSwapTool',
  conversationId: 'conv-1',
  timestamp: 1700000000,
  currentStep: 0,
  completedSteps: [],
  skippedSteps: [],
  terminal: false,
  meta: {},
  ...overrides,
})
```

In each test, change:
- `toolType: 'swap'` → `toolName: 'initiateSwapTool'`
- `toolType: 'send'` → `toolName: 'sendTool'`
- `toolType: 'limit_order'` → `toolName: 'createLimitOrderTool'`
- `toolType: 'cancel_limit_order'` → `toolName: 'cancelLimitOrderTool'`

Also update hash field references in test fixtures:
- `meta: { swapTxHash: '0xswap' }` → `meta: { txHash: '0xswap' }`
- `meta: { sendTxHash: '0xsend' }` → `meta: { txHash: '0xsend' }`
- `meta: { swapTxHash: '0xswap', approvalTxHash: '0xapproval' }` → `meta: { txHash: '0xswap', approvalTxHash: '0xapproval' }`

**Step 2: Run tests to verify they fail**

Run: `cd apps/agentic-chat && bun test src/lib/__tests__/activityNormalizer.test.ts`
Expected: FAIL

**Step 3: Update activityNormalizer.ts**

```ts
import type { CreateLimitOrderOutput, InitiateSwapOutput, SendOutput } from '@shapeshiftoss/agentic-server'

import type {
  ActivityItem,
  LimitOrderActivityDetails,
  SendActivityDetails,
  SwapActivityDetails,
} from '@/types/activity'

import type { LimitOrderMeta, SendMeta, SwapMeta, ToolExecutionState } from './executionState'

export function normalizeToActivityItem(tx: ToolExecutionState): ActivityItem | null {
  switch (tx.toolName) {
    case 'initiateSwapTool':
    case 'initiateSwapUsdTool':
      return normalizeSwapActivity(tx as ToolExecutionState<SwapMeta>)
    case 'sendTool':
      return normalizeSendActivity(tx as ToolExecutionState<SendMeta>)
    case 'createLimitOrderTool':
      return normalizeLimitOrderActivity(tx as ToolExecutionState<LimitOrderMeta>)
    default:
      return null
  }
}

function normalizeSwapActivity(tx: ToolExecutionState<SwapMeta>): ActivityItem | null {
  const output = tx.toolOutput as InitiateSwapOutput | undefined
  const txHash = tx.meta.txHash
  const approvalTxHash = tx.meta.approvalTxHash

  if (!output?.summary?.sellAsset || !output?.summary?.buyAsset || !txHash) return null

  const details: SwapActivityDetails = {
    sellAsset: {
      symbol: output.summary.sellAsset.symbol,
      amount: output.summary.sellAsset.amount,
      valueUSD: output.summary.sellAsset.valueUSD,
    },
    buyAsset: {
      symbol: output.summary.buyAsset.symbol,
      amount: output.summary.buyAsset.estimatedAmount,
      valueUSD: output.summary.buyAsset.estimatedValueUSD,
    },
    dex: output.summary.exchange.provider,
    fee: output.summary.exchange.networkFeeUsd,
    ...(approvalTxHash && {
      approval: {
        txHash: approvalTxHash,
        spender: output.swapData.approvalTarget,
      },
    }),
  }

  return {
    id: tx.toolCallId,
    type: 'swap',
    timestamp: tx.timestamp,
    txHash,
    chainId: output.swapData.sellAsset.chainId,
    network: output.summary.sellAsset.network,
    details,
  }
}

function normalizeSendActivity(tx: ToolExecutionState<SendMeta>): ActivityItem | null {
  const output = tx.toolOutput as SendOutput | undefined
  const txHash = tx.meta.txHash

  if (!output?.summary || !txHash) return null

  const details: SendActivityDetails = {
    asset: {
      symbol: output.summary.symbol,
      amount: output.summary.amount,
    },
    from: output.summary.from,
    to: output.summary.to,
    fee: output.summary.estimatedFeeUsd,
    feeSymbol: output.summary.estimatedFeeSymbol,
  }

  return {
    id: tx.toolCallId,
    type: 'send',
    timestamp: tx.timestamp,
    txHash,
    chainId: output.sendData.chainId,
    network: output.summary.network,
    details,
  }
}
```

The `normalizeLimitOrderActivity` function stays unchanged (it doesn't use hash fields that were renamed).

**Step 4: Update ActivityList.tsx**

Change the filter on line 25:

```ts
// Before:
.filter(tx => tx.toolType === 'swap' || tx.toolType === 'send' || tx.toolType === 'limit_order')
// After:
.filter(tx => tx.toolName === 'initiateSwapTool' || tx.toolName === 'initiateSwapUsdTool' || tx.toolName === 'sendTool' || tx.toolName === 'createLimitOrderTool')
```

Also update the `toolName` property access (the `.filter(tx => tx.toolType ===` becomes `.filter(tx => tx.toolName ===`).

**Step 5: Run tests to verify they pass**

Run: `cd apps/agentic-chat && bun test src/lib/__tests__/activityNormalizer.test.ts`
Expected: PASS

**Step 6: Verify full type-check**

Run: `cd apps/agentic-chat && bunx tsc --noEmit`
Expected: PASS (all errors resolved)

**Step 7: Commit**

```bash
git add apps/agentic-chat/src/types/activity.ts apps/agentic-chat/src/lib/activityNormalizer.ts apps/agentic-chat/src/components/Portfolio/ActivityList.tsx apps/agentic-chat/src/components/Portfolio/ActivityRow/ActivityRow.tsx apps/agentic-chat/src/lib/__tests__/activityNormalizer.test.ts
git commit -m "refactor: activity system uses ToolName and normalized txHash"
```

---

### Task 8: Final Verification

**Step 1: Run all tests**

Run: `cd apps/agentic-chat && bun test`
Expected: All tests pass

**Step 2: Run server type-check**

Run: `cd apps/agentic-server && bunx tsc --noEmit`
Expected: No errors

**Step 3: Run frontend type-check**

Run: `cd apps/agentic-chat && bunx tsc --noEmit`
Expected: No errors

**Step 4: Run lint**

Run: `bun run lint`
Expected: No errors (or only pre-existing ones)

If any errors, fix and commit:

```bash
git add -A
git commit -m "fix: lint and type errors from tool registry consolidation"
```

---

## Gotchas Checklist

- [ ] `useConditionalOrderExecution` config interface: `toolType` → `toolName` (affects StopLossUI, TwapUI)
- [ ] `useCancelConditionalOrderExecution` config interface: `toolType` → `toolName` (affects CancelStopLossUI, CancelTwapUI)
- [ ] `CancelConditionalOrderConfig.toolType` branching in analytics (line 84): update to `toolName === 'cancelStopLossTool'`
- [ ] `ActivityList.tsx` filter must include BOTH `initiateSwapTool` and `initiateSwapUsdTool`
- [ ] `activityNormalizer.ts` switch must handle both `initiateSwapTool` and `initiateSwapUsdTool` (fall-through)
- [ ] `VaultWithdrawAllMeta` uses `chainResults[]` with per-chain `txHash` — leave as-is (not renamed)
- [ ] `getAllowanceTool` in buildTools() keeps custom composition — not through wrapTools()
- [ ] `ToolExecutionState.toolOutput` type changes from union to `unknown` — callers already cast with `as`

**2026-03-11T23:30:33Z**

# Merged: sa2-trqp (Discriminated Union for Type-Safe Narrowing)

sa2-trqp has been merged into this ticket. Its goals (type-safe narrowing without `as` casts) are folded into the existing tasks below. sa2-trqp is now closed.

## Additional Changes Per Task

### Task 3 additions (executionState.ts)

After deleting ToolType/ToolOutput and renaming toolType→toolName, also add:

1. Move `NetworkSwitchMeta` from `SwitchNetworkUI.tsx` to `executionState.ts`:

```ts
export type NetworkSwitchPhase = 'idle' | 'switching' | 'success' | 'error'

export interface NetworkSwitchMeta {
  network?: string
  phase: NetworkSwitchPhase
}
```

2. Add `ToolMetaMap` mapping every `ToolName` to its meta type:

```ts
export type ToolMetaMap = {
  sendTool: SendMeta
  initiateSwapTool: SwapMeta
  initiateSwapUsdTool: SwapMeta
  switchNetworkTool: NetworkSwitchMeta
  portfolioTool: Record<string, never>
  getAssetsTool: Record<string, never>
  lookupExternalAddress: Record<string, never>
  transactionHistoryTool: Record<string, never>
  getAllowanceTool: Record<string, never>
  receiveTool: Record<string, never>
  getTrendingTokensTool: Record<string, never>
  getTopGainersLosersTool: Record<string, never>
  getNewCoinsTool: Record<string, never>
  createLimitOrderTool: LimitOrderMeta
  getLimitOrdersTool: Record<string, never>
  cancelLimitOrderTool: CancelLimitOrderMeta
  createStopLossTool: ConditionalOrderMeta
  getStopLossOrdersTool: Record<string, never>
  cancelStopLossTool: CancelConditionalOrderMeta
  createTwapTool: ConditionalOrderMeta
  getTwapOrdersTool: Record<string, never>
  cancelTwapTool: CancelConditionalOrderMeta
  checkWalletCapabilitiesTool: Record<string, never>
  vaultDepositTool: VaultDepositMeta
  vaultWithdrawTool: VaultWithdrawMeta
  vaultWithdrawAllTool: VaultWithdrawAllMeta
  getAssetPricesTool: Record<string, never>
}
```

3. Add `ToolExecutionStateFor<K>` and `AnyToolExecutionState`:

```ts
export type ToolExecutionStateFor<K extends ToolName> = Omit<ToolExecutionState, 'toolName' | 'meta'> & {
  toolName: K
  meta: ToolMetaMap[K]
}

export type AnyToolExecutionState = { [K in ToolName]: ToolExecutionStateFor<K> }[ToolName]
```

Keep the generic `ToolExecutionState<TMeta>` for the pure helper functions (`advanceStep`, `failStep`, etc.) — they only touch shared fields.

### Task 4 additions (useToolExecution.ts)

Change the generic from `<TMeta extends object>` to `<K extends ToolName>`:

```ts
export function useToolExecution<K extends ToolName>(
  toolCallId: string,
  toolName: K,
  initialMeta: ToolMetaMap[K]
): ExecutionContext<ToolMetaMap[K]>
```

TypeScript infers `K` from the `toolName` argument, so call sites simplify:
- Before: `useToolExecution<SwapMeta>(toolCallId, 'swap', {})`
- After: `useToolExecution(toolCallId, 'initiateSwapTool', {})`

Import `ToolMetaMap` from executionState and `ToolName` from toolOutput.

### Task 5 additions (tool UI components)

Remove explicit type params from all `useToolExecution` calls — inference handles it:
- `useToolExecution<SwapMeta>(toolCallId, 'initiateSwapTool', {})` → `useToolExecution(toolCallId, 'initiateSwapTool', {})`
- `useToolExecution<SendMeta>(toolCallId, 'sendTool', {})` → `useToolExecution(toolCallId, 'sendTool', {})`
- etc.

**SwitchNetworkUI.tsx** — remove local `NetworkSwitchMeta` and `NetworkSwitchPhase` definitions, import from `@/lib/executionState`:
```ts
import type { NetworkSwitchMeta } from '@/lib/executionState'
```
Remove explicit type param: `useToolExecution(toolCallId, 'switchNetworkTool', { phase: 'idle' })`

**useConditionalOrderExecution.tsx** — update config interface:
```ts
// Before:
toolType: ToolExecutionState<ConditionalOrderMeta>['toolType']
// After:
toolName: 'createStopLossTool' | 'createTwapTool'
```

**useCancelConditionalOrderExecution.tsx** — update config interface:
```ts
// Before:
toolType: 'cancel_stop_loss' | 'cancel_twap'
// After:
toolName: 'cancelStopLossTool' | 'cancelTwapTool'
```

### Task 7 additions (activityNormalizer.ts)

Remove all `as` casts — the discriminated union handles narrowing:

```ts
export function normalizeToActivityItem(tx: AnyToolExecutionState): ActivityItem | null {
  switch (tx.toolName) {
    case 'initiateSwapTool':
    case 'initiateSwapUsdTool':
      // tx.meta is now narrowed to SwapMeta automatically
      return normalizeSwapActivity(tx)
    case 'sendTool':
      // tx.meta is now narrowed to SendMeta automatically
      return normalizeSendActivity(tx)
    case 'createLimitOrderTool':
      // tx.meta is now narrowed to LimitOrderMeta automatically
      return normalizeLimitOrderActivity(tx)
    default:
      return null
  }
}
```

Update the normalizer function signatures to accept `ToolExecutionStateFor<K>` instead of `ToolExecutionState<Meta>`:
```ts
function normalizeSwapActivity(tx: ToolExecutionStateFor<'initiateSwapTool'> | ToolExecutionStateFor<'initiateSwapUsdTool'>): ActivityItem | null
function normalizeSendActivity(tx: ToolExecutionStateFor<'sendTool'>): ActivityItem | null
function normalizeLimitOrderActivity(tx: ToolExecutionStateFor<'createLimitOrderTool'>): ActivityItem | null
```

The `tx.toolOutput` field is still `unknown` and will need a cast to the specific output type (e.g., `tx.toolOutput as InitiateSwapOutput`). This is acceptable — output types come from the server and can't be narrowed by the discriminated union without a runtime check.

### Store considerations (chatStore.ts)

The store's `persistedTransactions: ToolExecutionState[]` and `runtimeToolStates: Map<string, ToolExecutionState>` stay as generic `ToolExecutionState` (not `AnyToolExecutionState`). The discriminated union is used at consumption sites (normalizer, UI) where narrowing matters. The store just holds the data — forcing the union there would require runtime validation on hydration from localStorage, which isn't worth it for a beta product.

### Execution.tsx

No changes needed — it uses `ToolExecutionState` (the generic base interface) which remains valid. It only accesses shared fields (`completedSteps`, `skippedSteps`, `error`).

## Gotchas from sa2-trqp

- `useConditionalOrderExecution` takes a union toolName (`'createStopLossTool' | 'createTwapTool'`) — `K extends ToolName` works when K is itself a union
- The store uses immer's `produce` with generic types — works fine since we keep the generic interface in the store
- `NetworkSwitchPhase` type must move alongside `NetworkSwitchMeta` to `executionState.ts`
