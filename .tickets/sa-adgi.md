---
id: sa-adgi
status: closed
deps: []
links: []
created: 2026-03-05T09:04:01Z
type: bug
priority: 1
assignee: Jibles
---
# Safe ownership verification: fix bypass for undeployed Safes

## Problem
`verifySafeOwnership` in `safeAddressVerification.ts` silently passes when the Safe contract is not yet deployed (`code === '0x'`). This means a client can claim any predicted Safe address that hasn't been deployed.

Additionally, `getSafeAddressForChain` (used in read paths like `getStopLossOrders`, `getTwapOrders`, `vaultBalance`) skips ownership verification entirely — it reads directly from client-supplied `safeDeploymentState`.

## Solution
Needs design. Options:
1. Derive the predicted Safe address server-side from the EOA (deterministic CREATE2)
2. Require a signature proof that the EOA owns the predicted Safe
3. At minimum, verify the predicted address matches what CREATE2 would produce for the given EOA

## Files
- `apps/agentic-server/src/utils/safeAddressVerification.ts`
- `apps/agentic-server/src/utils/walletContextSimple.ts`

## Acceptance Criteria

- [ ] Undeployed Safe addresses are verified (e.g., CREATE2 derivation matches claimed address)
- [ ] Read-path helpers (`getSafeAddressForChain`) validate ownership or derivation
- [ ] Cannot impersonate another user's Safe by sending a fake safeAddress
- [ ] Works for both deployed and undeployed Safes
