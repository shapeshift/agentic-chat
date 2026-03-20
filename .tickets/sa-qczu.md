---
id: sa-qczu
status: closed
type: bug
priority: 1
assignee: Jibles
created: 2026-03-14T00:06:56Z
---
# Parallel swap execution: stale quotes and approval race conditions

## Investigation Findings (2026-03-14)

Root cause analysis in the ticket is confirmed accurate against the code.

Key findings:
- The architectural split (server: eager quote+allowance, client: locked execution) is the fundamental issue
- BebopQuote.expiry exists in the type but is never validated or surfaced
- getAllowance is called at quote time, not execution time
- Exact-amount approvals (not MaxUint256) compound the race condition
- walletMutex itself works correctly; it's just in the wrong layer

Simplest fix path: re-fetch quote + re-check allowance inside withWalletLock, or move the lock boundary to encompass quote fetching.

## Acceptance Criteria

- [ ] Multiple parallel swaps (2-3) all complete successfully
- [ ] Each swap gets a fresh/valid quote at execution time
- [ ] Allowance is sufficient for each swap at execution time
- [ ] Quote expiry is validated before submitting swap transaction
- [ ] No "Execution reverted" or "insufficient allowance" errors for queued swaps

