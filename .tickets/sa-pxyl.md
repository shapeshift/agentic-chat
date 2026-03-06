---
id: sa-pxyl
status: closed
deps: []
links: []
created: 2026-03-02T13:58:15Z
type: bug
priority: 1
assignee: Jibles
---
# TWAP: Add balance validation before order creation

**Objective:** The TWAP creation flow should validate that the user has sufficient sell-token balance before submitting any on-chain transactions. Currently it creates approvals and registers ComposableCoW orders regardless of balance, and CoW solvers silently skip unfillable orders — all parts expire with zero feedback.

**Context & Findings:**
- `createTwap.ts:265` already calls `getBalance(safeAddress, sellAsset)` to check the Safe balance and compute a deposit amount
- But it never checks the EOA balance — it just builds a deposit tx that will fail or be insufficient
- The approval tx (`approve` on ERC20) and `createWithContext` on ComposableCoW both succeed regardless of actual token balance since neither transfers tokens
- Tokens are only needed at settlement time when solvers try to fill — solvers check balance, find it insufficient, and skip the order
- A test TWAP for "2.5 WBTC" was created on Arbitrum with insufficient balance; all 4 parts expired unfilled over 80 minutes

**Files:**
- `apps/agentic-server/src/tools/twap/createTwap.ts` — main change location. `getBalance` is already imported from `../../utils/balanceHelpers`. The validation should go after the Safe balance check at line 265, before building any transactions
- `apps/agentic-server/src/utils/balanceHelpers.ts` — reference for `getBalance` signature/usage
- Pattern reference: check how `initiateSwap` handles balance validation (if it does) for consistency

**Gotchas:**
- `getBalance` needs the asset object, not just an address — the EOA check needs to use the EOA address not the Safe address
- The committed amount from existing active orders (lines 194-207) should factor into the "already available" calculation
- Don't block on the EOA check if Safe already has enough (it's an extra RPC call)

## Acceptance Criteria

- [ ] Before building deposit/approval/order txs, check Safe balance of sell token
- [ ] If Safe balance < totalAmount, check EOA balance of sell token
- [ ] If Safe balance + EOA balance < totalAmount, throw a descriptive error including: required amount, Safe balance, EOA balance, and token symbol
- [ ] If Safe has enough, no deposit needed — existing logic handles this
- [ ] If Safe + EOA combined have enough, proceed with deposit as current code does
- [ ] Error message uses human-readable amounts (not base units)
- [ ] Lint and type-check pass
