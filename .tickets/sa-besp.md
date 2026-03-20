---
id: sa-besp
status: closed
type: bug
priority: 2
assignee: Jibles
created: 2026-03-14T00:06:28Z
---
# Transaction history: swaps misclassified as contract interactions & duplicate tool calls

## Reproduction
1. Wallet: `0xeD3EFA66B743e2f0B5579d67E14599D01eFA2440` on Arbitrum
2. Ask: "what was my last swap?"
3. Observe: cards show "Contract interaction" instead of swap details

## Acceptance Criteria

- [ ] Swaps are correctly classified as 'swap' type even when indexer token transfer data is sparse
- [ ] UI displays swap pair (e.g., "ETH → PEPE") for swap transactions
- [ ] Type-specific queries use the types filter (e.g., types: ["swap"] for swap queries)
- [ ] Tool is not called with duplicate identical params for simple queries

