---
id: sa-ppkj
status: done
deps: []
links: [sa-wbvz]
created: 2026-03-06T08:06:55Z
type: feature
priority: 2
assignee: Jibles
---
# Distinguish failed TWAP orders from expired ones

## Objective

When a TWAP order expires without any parts being filled (e.g. amounts too small for solvers), it currently shows as "Expired" — the same status as a partially-filled TWAP that ran out of time. Users can't tell whether their order partially worked or completely failed. Add a "failed" status to clearly communicate that no execution happened.

## User Story

Users whose TWAP orders were ignored by solvers need to see "Failed" (not "Expired") so they understand something went wrong and can retry with better parameters.

## Context & Findings

- Current status derivation in `getTwapOrders.ts:115-127`: if the TWAP window has passed and it's not fulfilled, it's always "expired" — no distinction between 0 fills and partial fills
- The `isTwapFulfilled` function (line 62) already counts matching filled parts via `matchingFilledParts.length` — this count is computed but discarded (only used for a boolean `>= numParts` check)
- We can refactor to return the fill count instead of a boolean, then use it to distinguish: 0 fills = "failed", some fills = "expired", all fills = "fulfilled"
- `CowOrderStatus` type in `lib/cow/types.ts:5` currently: `'open' | 'submitted' | 'fulfilled' | 'cancelled' | 'expired'` — needs "failed" added
- The client-side `OrderRecord` status in `orderStore.ts:15` is: `'open' | 'triggered' | 'fulfilled' | 'cancelled' | 'expired'` — also needs "failed"
- The UI in `GetTwapOrdersUI.tsx` has a `STATUS_CONFIG` map (line 15) that drives badge icon/color/label — add a "failed" entry
- Observed behavior: TWAP with ~$0.17/part on Arbitrum — watchtower created all parts, every one expired with `executedSellAmount: "0"`. Showed as "Expired" with no indication of failure
- Related ticket sa-lsyc handles prevention (warning before creation); this ticket handles detection (showing failure after the fact)

## Design Constraints

- "Failed" should be visually distinct from "Expired" — suggest red/warning color with an alert icon, similar to "Cancelled" but different icon
- The LLM system prompt should explain the "failed" status so the agent can offer actionable advice (retry with larger amounts, fewer intervals)
- Stop-loss orders can also fail to fill — consider whether the same logic applies there (single order, so it's simpler: expired with `executedSellAmount === "0"` = failed)

## Files

- `apps/agentic-server/src/lib/cow/types.ts` — add `'failed'` to `CowOrderStatus` union type
- `apps/agentic-server/src/tools/twap/getTwapOrders.ts` — refactor `isTwapFulfilled` to return fill count (or a status enum) instead of boolean; use count to derive `'fulfilled'` / `'expired'` / `'failed'` in `getRegistryOrders`
- `apps/agentic-server/src/routes/chat.ts` — update system prompt TWAP section to explain "failed" status and suggest remediation
- `apps/agentic-chat/src/stores/orderStore.ts` — add `'failed'` to `OrderRecord['status']` union
- `apps/agentic-chat/src/components/tools/GetTwapOrdersUI.tsx` — add `'failed'` to `TwapOrderStatus` type and `STATUS_CONFIG` map (suggest: red/orange color, `AlertTriangle` icon, label "Failed")
- `apps/agentic-server/src/tools/twap/getTwapOrdersSchema` — update the status enum to include `'failed'` as a filterable option
- `apps/agentic-server/src/utils/walletContextSimple.ts` — add `'failed'` to `ActiveOrderSummary['status']` union

## Acceptance Criteria

- [ ] `isTwapFulfilled` refactored to return filled part count (not just boolean)
- [ ] TWAP with 0 filled parts shows status "failed" (not "expired")
- [ ] TWAP with some but not all filled parts shows status "expired"
- [ ] TWAP with all parts filled shows status "fulfilled" (unchanged)
- [ ] "failed" added to all relevant status union types (CowOrderStatus, OrderRecord, ActiveOrderSummary, TwapOrderStatus in UI)
- [ ] UI badge for "failed": distinct color and icon, clearly different from "expired"
- [ ] getTwapOrders status filter accepts "failed" as a valid filter value
- [ ] System prompt explains "failed" status and advises increasing amounts or reducing intervals
- [ ] Lint and type-check pass

## Gotchas

- The `needsFulfillmentCheck` guard (line 102) only fetches CoW orders when there are past-validTo orders that are still on-chain active — this is also needed for "failed" detection, so the guard logic still works
- If `cowOrders` fetch fails (catch block at line 110), we can't distinguish failed from expired — fall back to "expired" (safe default, same as current behavior)
- Orders created before the `numParts` field was added won't have part count data — `isTwapFulfilled` already returns false for these, so they'll show as "expired" (not "failed"). This is acceptable
- Stop-loss `getStopLossOrders.ts` has similar status derivation — consider adding "failed" there too for consistency, but scope it separately if preferred
