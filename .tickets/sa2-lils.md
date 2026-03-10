---
id: sa2-lils
status: open
deps: []
links: []
created: 2026-03-10T08:11:48Z
type: bug
priority: 2
assignee: Jibles
---
# TX history UI renders wrong transaction when AI identifies a specific type

## Objective

When users ask about a specific transaction type (e.g. "last swap"), the rendered UI card should match what the AI describes — not blindly show `transactions[0]` which may be an unrelated transaction.

## Context & Findings

- **Root cause:** The AI calls `transactionHistoryTool` with `{ offset: 0, includeTransactions: true, renderTransactions: 1 }` but no `types` filter. Backend returns all transaction types sorted by recency. The AI finds the swap in the full list and describes it correctly in text, but the UI renders `transactions.slice(0, renderCount)` — always from index 0.
- If the most recent tx is an approval or other contract interaction (not the swap), the card shows "Contract interaction / ETH / N/A" while the AI text correctly describes the swap.
- **Reproduction:** Ask "what was my last swap?" when the most recent overall transaction is not a swap (e.g. a token approval or contract interaction is more recent). The AI text will correctly identify the swap, but the UI card will render the wrong transaction.
- **Observed:** UI card shows "Contract interaction / ETH / N/A" for a USDC→USDT swap on Arbitrum
- **Expected:** UI card should show the swap with correct token pair and amounts
- `renderTransactions` is purely a client-side UI hint controlling how many cards to display — backend ignores it
- The `types` filter param already exists in the tool schema and would solve this if the AI used it
- Rejected: modifying `renderTransactions` to support index-based rendering — overly complex for what is primarily a prompt guidance issue

## Files

- `apps/agentic-server/src/tools/transactionHistory.ts:113-122` — tool description/parameter guidance, add instruction to use `types` filter for type-specific queries
- `apps/agentic-server/src/routes/chat.ts:328` — system prompt TX history optimization section
- `apps/agentic-chat/src/components/tools/GetTransactionHistoryUI.tsx:228` — `transactions.slice(0, renderCount)` rendering logic (reference only)
- `apps/agentic-server/src/lib/transactionHistory/schemas.ts` — reference for existing `types` filter schema

## Acceptance Criteria

- [ ] Tool description includes explicit guidance to use `types` filter when user asks about specific transaction types (e.g. "last swap" → `types: ['swap']`)
- [ ] System prompt TX history optimization section reinforces using `types` filter for type-specific queries
- [ ] UI card matches the transaction the AI describes in text when filters are applied correctly
- [ ] General queries ("show my recent transactions") continue to work without `types` filter
- [ ] Lint and type-check pass

## Gotchas

- The `types` filter already exists in the schema — this is primarily a prompt/instruction fix, not a schema change
- `renderTransactions` is purely a client-side UI hint; the backend ignores it
- Don't break the existing behavior where no `types` filter returns all transaction types for general queries
