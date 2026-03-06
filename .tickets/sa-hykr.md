---
id: sa-hykr
status: closed
deps: []
links: []
created: 2026-03-05T09:04:11Z
type: bug
priority: 2
assignee: Jibles
---
# Fix stale closures in execution hooks (ref pattern migration)

## Problem
All 11+ execution hooks (useCancelConditionalOrderExecution, useCancelLimitOrderExecution, useLimitOrderExecution, useSendExecution, useStopLossExecution, useSwapExecution, useTwapExecution, useVaultDepositExecution, useVaultWithdrawExecution, useVaultWithdrawAllExecution, useNetworkSwitch) capture `evmAddress`, `evmWallet`, `primaryWallet`, `activeConversationId`, etc. from the render scope in async callbacks.

These callbacks close over initial values. If the wallet reconnects or user switches wallets mid-execution, stale references are used. Most critically, `activeConversationId` from `useParams` can go stale, causing `persistState` calls to silently fail.

## Solution
Migrate to the ref pattern already used in `ChatProvider` (`walletRef`). For each hook:
1. Store mutable values (`evmAddress`, `evmWallet`, `primaryWallet`, `activeConversationId`) in refs
2. Update refs on each render
3. Read from refs inside async callbacks

## Files
All `apps/agentic-chat/src/hooks/use*Execution*` files (11+ files)

## Acceptance Criteria

- [ ] All execution hooks use refs for values read in async callbacks
- [ ] Wallet changes mid-execution use latest values
- [ ] activeConversationId changes are reflected in persistState calls
- [ ] No regressions in existing execution flows
