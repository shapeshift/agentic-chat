---
id: sa-qczu
status: open
deps: []
links: []
created: 2026-03-14T00:06:56Z
type: bug
priority: 1
assignee: Jibles
---
# Parallel swap execution: stale quotes and approval race conditions

## Summary

When executing multiple swaps in parallel (e.g., 3x PEPE→ETH on Arbitrum), the lock mechanism correctly serializes execution, but subsequent swaps fail because:

1. **Quote staleness** — quotes expire while waiting in the lock queue
2. **Approval race condition** — allowance is checked at quote time but executed later, causing insufficient allowance errors

## Observed Behavior

**Test 1 (3 swaps: $0.5, $0.7, $0.9 PEPE→ETH):**
- Swap 1: succeeds
- Swaps 2 & 3: fail at "Sign swap transaction" with "Execution reverted for an unknown reason"

**Test 2 (2 swaps: $0.5, $0.7 PEPE→ETH):**
- Swap 1: succeeds
- Swap 2: skips approval step, fails with "ERC20: insufficient allowance"

## Root Cause Analysis

### Quote Staleness
- Quotes are generated in parallel BEFORE the lock (`initiateSwap.ts:209-272`)
- Bebop quotes include an `expiry` field (`getBebopRate/types.ts:36`) but it is **never returned or validated**
- The lock (`walletMutex.ts`) queues swaps for serial execution
- By the time swap 2+ executes, its quote/unsignedTx is expired on-chain → revert

### Approval Race Condition
- Allowance is checked at quote time (`initiateSwap.ts:224-231`)
- All parallel quotes see the same initial allowance state (e.g., 0)
- Each builds an approval for its exact amount (`approvalHelpers.ts:10-34`)
- Swap 1's approval sets allowance to its amount, then swap 1 consumes it
- Swap 2's pre-built approval may or may not re-set allowance, but even if it does, the swap tx was built against stale state
- If swap 2 skips approval (because it was marked as not needed at quote time), it gets insufficient allowance

### No Nonce Management
- EVM transaction sending (`chains/evm/transaction.ts:12-79`) relies on wagmi's automatic nonce
- No explicit nonce tracking between queued transactions

## Key Files
- `apps/agentic-chat/src/lib/walletMutex.ts` — lock mechanism (works, but masks deeper issues)
- `apps/agentic-server/src/tools/initiateSwap.ts` — quote generation + allowance check
- `apps/agentic-server/src/utils/approvalHelpers.ts` — builds exact-amount approvals
- `apps/agentic-server/src/utils/getAllowance.ts` — allowance check at quote time
- `apps/agentic-server/src/utils/getBebopRate/types.ts` — BebopQuote has unused `expiry`
- `apps/agentic-chat/src/components/tools/useSwapExecution.tsx` — execution orchestration

## Suggested Fix Direction
1. **Re-fetch quote inside the lock** — move quote fetching (or at least re-validation) into the locked section of `useSwapExecution.tsx` so each swap has a fresh quote
2. **Re-check allowance before approval** — don't rely on the quote-time allowance check; re-check just before executing the approval tx
3. **Use max approval or accumulate** — approve for max uint256 or sum of all pending swap amounts
4. **Validate quote expiry** — store and check `expiry` before submitting swap tx

## Acceptance Criteria

- [ ] Multiple parallel swaps (2-3) all complete successfully
- [ ] Each swap gets a fresh/valid quote at execution time
- [ ] Allowance is sufficient for each swap at execution time
- [ ] Quote expiry is validated before submitting swap transaction
- [ ] No "Execution reverted" or "insufficient allowance" errors for queued swaps

## Notes

**2026-03-14T01:02:13Z**

## Investigation Findings (2026-03-14)

Root cause analysis in the ticket is confirmed accurate against the code.

Key findings:
- The architectural split (server: eager quote+allowance, client: locked execution) is the fundamental issue
- BebopQuote.expiry exists in the type but is never validated or surfaced
- getAllowance is called at quote time, not execution time
- Exact-amount approvals (not MaxUint256) compound the race condition
- walletMutex itself works correctly; it's just in the wrong layer

Simplest fix path: re-fetch quote + re-check allowance inside withWalletLock, or move the lock boundary to encompass quote fetching.
