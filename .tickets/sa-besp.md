---
id: sa-besp
status: open
deps: []
links: []
created: 2026-03-14T00:06:28Z
type: bug
priority: 2
assignee: Jibles
---
# Transaction history: swaps misclassified as contract interactions & duplicate tool calls

## Summary

When asking "what was my last swap?", the transaction history tool has two issues:

1. **Swaps displayed as "Contract interaction"** — the UI cards show generic "Contract interaction / ETH / N/A" instead of properly parsed swap details, even though the LLM text response correctly identifies the swap.
2. **Duplicate tool calls** — `transactionHistoryTool` is called twice with identical params `{"offset": 0, "includeTransactions": true, "renderTransactions": 1}`.

## Root Cause Analysis

### Misclassification
- `evmParser.ts:74-114` — `determineTransactionType()` falls back to `'contract'` when token transfer data is missing or incomplete from the indexer
- When type is `'contract'` instead of `'swap'`, `transactionUtils.ts:getSwapTokens()` returns null (requires `tx.type === 'swap'` AND 2+ token transfers)
- UI then renders the fallback "Contract interaction" card instead of swap pair display

### Missing type filter
- The LLM is not setting `types: ["swap"]` filter when asking about swaps
- System prompt guidance exists at `chat.ts:348` but is advisory only — LLM sometimes ignores it
- Without the filter, any recent transaction type can be returned

### Duplicate calls
- Likely LLM behavior (up to 5 sequential tool calls allowed via `stepCountIs(5)`)
- LLM may call twice when first result doesn't match expectations, or simply non-deterministic duplication

## Key Files
- `apps/agentic-server/src/lib/transactionHistory/evmParser.ts` — tx type classification
- `apps/agentic-server/src/routes/chat.ts:343-348` — LLM type filter guidance
- `apps/agentic-chat/src/components/tools/GetTransactionHistoryUI.tsx` — UI rendering
- `apps/agentic-chat/src/lib/transactionUtils.ts` — swap token detection

## Reproduction
1. Wallet: `0xeD3EFA66B743e2f0B5579d67E14599D01eFA2440` on Arbitrum
2. Ask: "what was my last swap?"
3. Observe: cards show "Contract interaction" instead of swap details

## Acceptance Criteria

- [ ] Swaps are correctly classified as 'swap' type even when indexer token transfer data is sparse
- [ ] UI displays swap pair (e.g., "ETH → PEPE") for swap transactions
- [ ] Type-specific queries use the types filter (e.g., types: ["swap"] for swap queries)
- [ ] Tool is not called with duplicate identical params for simple queries
