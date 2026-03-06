---
id: sa-lrpa
status: closed
deps: []
links: []
created: 2026-03-02T13:58:24Z
type: bug
priority: 1
assignee: Jibles
---
# Generalize USD dollar-amount handling to all trade types

**Objective:** Add a system prompt rule that detects dollar-amount patterns ("$X worth", "$X of TOKEN", "X dollars") across ALL trade types and instructs the AI to convert to token amounts before calling the tool. Currently only swaps have this routing (via `initiateSwapUsd`); TWAP, stop-loss, and limit orders silently misinterpret dollar values as token amounts.

**Context & Findings:**
- Swap workflow has explicit routing at `chat.ts:323-328`: use `initiateSwap` for token amounts, `initiateSwapUsd` for dollar amounts
- TWAP section at `chat.ts:368-379` has no such rule, even though its own examples use dollar amounts ("buy $1000 of ETH over 24 hours")
- `createTwap` schema (`createTwap.ts:87-99`) only accepts `totalAmount` as a token amount string
- A user saying "$2.5 worth of WBTC" resulted in a 2.5 WBTC order (~$165k) instead of ~0.0000379 WBTC (~$2.50) — 66,000x too large
- No `createTwapUsd` tool exists, and creating one for every tool type would be excessive

**Files:**
- `apps/agentic-server/src/routes/chat.ts` — Add a general rule in the Trade Intent Routing section (around line 315-321) that applies before individual tool routing. The rule should instruct the AI to: detect dollar-amount intent, look up the token's current price, convert to token amount, then call the appropriate tool with the token amount
- Reference pattern: the swap USD routing at lines 323-328 for the detection patterns to match

**Gotchas:**
- The AI needs access to price data for the conversion — it can use the existing `getSimplePrices` or the AI can be instructed to ask the user to confirm the converted amount before proceeding
- Don't remove `initiateSwapUsd` — it does server-side conversion which is more reliable than AI math
- The dollar-amount rule should be ABOVE the individual tool routing sections so it's processed first

## Acceptance Criteria

- [ ] New general rule added to Trade Intent Routing section that covers all trade types (TWAP, stop-loss, limit orders)
- [ ] Rule fires on patterns: $X, $X worth, $X of TOKEN, X dollars worth, X USD of
- [ ] Rule instructs AI to convert dollar amount to token amount using market price before calling the tool
- [ ] Swap-specific routing (initiateSwapUsd) still works and takes precedence for swaps (don't break existing behavior)
- [ ] TWAP examples in system prompt updated to clarify the conversion expectation
- [ ] Tool descriptions for createTwap, createStopLoss, createLimitOrder clarify they expect token amounts not USD
- [ ] Lint and type-check pass
