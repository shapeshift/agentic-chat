---
id: sa-lsyc
status: closed
deps: []
links: []
created: 2026-03-06T06:20:41Z
type: feature
priority: 2
assignee: Jibles
---
# Add minimum per-part USD value validation for TWAP orders

## Objective

TWAP orders with very small per-part amounts (e.g. <$1 per part) will be ignored by CoW Protocol solvers because they're not profitable to fill. Currently there's no validation or warning — the order gets created on-chain, gas is spent, and all parts silently expire. Users have no idea why their order didn't execute.

## User Story

Users creating TWAP/DCA orders need to know upfront if their per-part amounts are too small for solvers to fill, rather than discovering it after the order expires unfilled.

## Context & Findings

- The only existing amount validation is `partSellAmount === 0n` in `createTwap.ts:128` — this only catches amounts that round to zero in base units
- CoW Protocol solvers have economic thresholds — gas costs on Arbitrum are low but still non-trivial for sub-dollar trades. On Ethereum mainnet the threshold is much higher
- Observed behavior: a TWAP with ~$0.17 per part on Arbitrum created parts via the watchtower every 5 minutes, but all expired with `executedSellAmount: "0"` — solvers never picked them up
- `createTwap.ts` already calls `getSimplePrices` (coingecko) for buy amount estimation — the price data is available
- The system prompt (`chat.ts:286`) mentions "amount too small" only for swap route failures, not for TWAP creation
- Stop-loss orders have the same potential issue but are single-execution, so less likely to hit it in practice

## Design Constraints

- Price lookup for the sell token is already happening in `createTwap.ts` via `getSimplePrices` — reuse it
- Network-aware thresholds: Ethereum mainnet needs a higher minimum than Arbitrum/Gnosis due to gas costs
- This should be a **warning with recommended minimums**, not a hard block — advanced users may have reasons to create small orders (e.g. testing)
- The warning should surface in the tool output so the LLM can communicate it to the user, AND ideally in the confirmation UI card

## Files

- `apps/agentic-server/src/tools/twap/createTwap.ts` — main change: after computing `partSellAmount` (~line 126), compute per-part USD value using the sell token price already fetched, compare against threshold, add warning to output
- `apps/agentic-server/src/tools/twap/createTwap.ts` — `CreateTwapOutput` interface: add optional `warnings?: string[]` field
- `apps/agentic-server/src/routes/chat.ts` — update TWAP section of system prompt to mention minimum amounts and instruct LLM to surface warnings
- `apps/agentic-chat/src/components/` — the TWAP confirmation card should display warnings if present (find the TWAP tool UI component)

## Acceptance Criteria

- [ ] Per-part USD value is computed using the sell token's current price
- [ ] Warning is added to output when per-part value is below threshold (suggested: ~$2 on Arbitrum/Gnosis, ~$10 on Ethereum — calibrate based on typical solver gas costs)
- [ ] Warning message includes the per-part USD value and the recommended minimum
- [ ] CreateTwapOutput includes optional warnings field
- [ ] System prompt instructs the LLM to surface TWAP warnings to the user and suggest increasing the amount or reducing intervals
- [ ] TWAP confirmation UI card displays warnings when present
- [ ] Order creation is NOT blocked — warning only (users can still proceed)
- [ ] Lint and type-check pass
