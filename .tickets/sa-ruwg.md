---
id: sa-ruwg
status: open
deps: []
links: []
created: 2026-03-19T23:01:40Z
type: bug
priority: 2
assignee: Jibles
---
# Agent sets wrong limitPrice for percentage-based limit orders

## Objective

When a user requests a limit order based on a percentage price change (e.g., "sell FOX if price goes up 2%"), the agent confuses the total USD order value with the per-token limit price, resulting in an order that will never execute. This is a prompt/reasoning bug — the tool code itself works correctly.

## Context & Findings

**Root cause:** The agent's system prompt has no guidance for computing limitPrice from a percentage-based request. The existing instructions cover:
- Converting USD amounts to token units (the `<usd-conversion>` block in `apps/agentic-server/src/routes/chat.ts:365-378`)
- Computing limitPrice from explicit amounts ("10 USDC for 20 USDT" → limitPrice = 20 ÷ 10 = 2)

But neither covers: "sell X if price goes up Y%", which requires:
1. Get current price per token ($0.006528/FOX)
2. Apply percentage: $0.006528 × 1.02 = $0.006659
3. Set limitPrice = 0.006659 (USDC per FOX)

**Reproduction:** User asked: "sell $2 worth of FOX on Arbitrum if the price goes up 2%, into USDC"
- Agent correctly computed sellAmount: 306.36 FOX (~$2 worth) ✓
- Agent set limitPrice = 2.04 ✗ (this is $2.00 × 1.02, the total USD value after 2% increase — NOT the per-token price)
- Resulting order: sell 306.36 FOX, buy 624.98 USDC at 1 FOX = 2.04 USDC
- This would only fill if FOX reaches $2.04/token (~31,000% increase from $0.0065)

**Observed vs expected:**
- Observed: limitPrice = 2.04 USDC/FOX, buyAmount = 624.98 USDC
- Expected: limitPrice ≈ 0.006659 USDC/FOX, buyAmount ≈ $2.04 USDC

**Rejected approaches:**
- Adding validation in the tool code: the tool correctly multiplies sellAmount × limitPrice — the values it received were just wrong. Guardrails could help as defense-in-depth but don't fix the root cause.

**Additional concern:** When the user challenged the 2.04 figure, the agent confabulated an explanation claiming the order "should execute correctly" despite the limit price being wrong. This is a secondary issue but worth noting — the agent should recognize obviously incorrect values when questioned.

## Files

- `apps/agentic-server/src/routes/chat.ts` — system prompt, around lines 365-428. Add percentage-based limit price calculation instructions to the `<cow-protocol>` or `<usd-conversion>` section.
- `apps/agentic-server/src/tools/limitOrder/createLimitOrder.ts` — the `limitPrice` schema description (line 31) could be enhanced with a percentage example. Reference only — no logic changes needed.

## Acceptance Criteria

- [ ] System prompt includes explicit instructions for computing limitPrice from percentage-based requests (e.g., "sell when price goes up X%")
- [ ] Instructions specify the formula: limitPrice = currentPricePerToken × (1 + percentage/100)
- [ ] An example is included showing a sub-cent token (like FOX at $0.0065) to prevent confusion with small numbers
- [ ] The limitPrice field description in createLimitOrder.ts includes a percentage-based example alongside the existing "worth X" example
- [ ] Consider adding a sanity-check note: if limitPrice differs from current market price by >100x, the agent should flag this to the user before submitting
- [ ] Lint and type-check pass

## Gotchas

- The limitPrice description says "sell A when worth X B" → limitPrice=X — this phrasing may reinforce the confusion for percentage requests where "worth" is ambiguous
- Stop-loss orders (createStopLoss.ts) likely have the same prompt gap for percentage-based trigger prices — check for consistency
- The <usd-conversion> block is about converting dollar amounts to token units, which is a different problem — don't conflate the two; add a separate section or example for percentage-based pricing
