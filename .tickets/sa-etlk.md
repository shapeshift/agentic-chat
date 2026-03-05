---
id: sa-etlk
status: closed
deps: []
links: []
created: 2026-03-05T01:21:05Z
type: bug
priority: 3
assignee: Jibles
---
# Stop-loss price validation error shows $0.00 for sub-cent tokens

## Objective

The stop-loss price validation error message uses `.toFixed(2)` to format the current price, which displays `$0.00` for tokens worth fractions of a cent (e.g., APE meme token at ~$0.000000048). This makes the error message nonsensical: "Trigger price ($0.00000005) must be below current price ($0.00)."

## Context & Findings

- **Root cause:** Two calls to `.toFixed(2)` in `createStopLoss.ts` — the error message (line 158) and the returned `currentPrice` field in the summary (line 271).
- **Reproduction:** Create a stop-loss for any token priced below $0.01. The error message and summary both show `$0.00`.
- **Observed:** Error says "must be below current price ($0.00)" — user can't tell what the actual price is.
- **Expected:** Display enough significant digits for the price to be meaningful, e.g., `$4.782e-8` or `$0.00000004782`.
- A `formatPrice` helper was partially implemented during investigation but needs to be applied and verified.

## Files

- `apps/agentic-server/src/tools/stopLoss/createStopLoss.ts` — two `.toFixed(2)` calls to replace (error message ~line 158, summary `currentPrice` ~line 271)

## Acceptance Criteria

- [ ] Error message shows meaningful price for tokens worth < $0.01 (use significant digits, e.g., `toPrecision(4)`)
- [ ] Summary `currentPrice` field also uses precision-aware formatting
- [ ] Prices >= $0.01 still display with 2 decimal places (no regression for normal tokens)
- [ ] Lint and type-check pass

## Gotchas

- Don't over-engineer — a simple inline helper is fine, no need for a shared utility
- Only the two `.toFixed(2)` calls in `createStopLoss.ts` need fixing; other files using `.toFixed(2)` (swap, portfolio, vault) deal with USD totals that won't be sub-cent
