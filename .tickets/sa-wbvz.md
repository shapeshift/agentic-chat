---
id: sa-wbvz
status: closed
deps: []
links: [sa-ppkj]
created: 2026-03-06T08:33:10Z
type: bug
priority: 1
assignee: Jibles
---
# Add stop-loss fulfillment detection — filled orders show as open/cancelled

## Problem

Stop-loss orders that have been successfully filled by the CoW Protocol watchtower are misclassified in the UI. When a stop-loss triggers and fills:

1. The on-chain `singleOrders` mapping still returns `true` (only `remove()` clears it, and filled orders aren't removed)
2. So the status derivation in `getStopLossOrders.ts:84-92` marks it as `'open'`
3. Eventually when `validTo` passes, it becomes `'expired'`
4. It is **never** shown as `'fulfilled'`

Meanwhile, the TWAP implementation already has `isTwapFulfilled` which queries the CoW API to detect fills. Stop-loss has no equivalent.

## Root Cause

In `getStopLossOrders.ts`, the status derivation is:
```ts
if (activeResults[i]) {
  derivedStatus = 'open'        // ← filled orders land here (still active on-chain)
} else if (order.validTo > 0 && order.validTo < nowSeconds) {
  derivedStatus = 'expired'
} else {
  derivedStatus = 'cancelled'   // ← filled orders also land here if removed
}
```

There is no CoW API check to detect whether the order was actually executed/settled.

## Solution

Query the CoW Protocol orderbook API for the Safe's orders, matching by token pair and `signingScheme: 'eip1271'`, similar to how `isTwapFulfilled` works in `getTwapOrders.ts:62-84`. For stop-loss, the check is simpler — look for a single filled order matching the sell/buy token pair with `executedSellAmount > "0"`.

The `CowOrderStatus` type already includes `'fulfilled'` — it's just never assigned for stop-loss orders.

## Files

- `apps/agentic-server/src/tools/stopLoss/getStopLossOrders.ts` — add fulfillment check via CoW API (similar to `isTwapFulfilled` pattern), update status derivation to assign `'fulfilled'`
- `apps/agentic-chat/src/components/tools/GetStopLossOrdersUI.tsx` — verify `STATUS_CONFIG` has a `'fulfilled'` entry (it likely already does from the shared pattern)

## Related

- sa-ppkj adds `'failed'` status for TWAP orders (0 fills vs partial fills) — same domain, different mechanism
- Both tickets touch status derivation for conditional orders; consider consolidating `getStopLossOrders`/`getTwapOrders` shared logic afterward (separate P2 chore)

## Acceptance Criteria

- [ ] Stop-loss orders filled by CoW Protocol show status 'fulfilled' (not 'open' or 'expired')\n- [ ] CoW API queried for fill detection, with graceful fallback on API failure\n- [ ] Unfilled expired orders still show 'expired'\n- [ ] Cancelled orders still show 'cancelled'\n- [ ] UI badge renders correctly for 'fulfilled' stop-loss orders\n- [ ] Lint and type-check pass
