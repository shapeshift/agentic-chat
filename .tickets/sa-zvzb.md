---
id: sa-zvzb
status: done
deps: []
links: []
created: 2026-03-06T08:47:51Z
type: feature
priority: 1
assignee: Jibles
---
# Vault withdraw: protect committed order balances with user choice

## Objective

Vault withdraw and withdraw-all tools should account for funds committed to active conditional orders (TWAP, stop-loss). Currently, users can withdraw tokens that are earmarked for active orders, breaking those orders. The tool should give users the choice to withdraw only excess funds or force-withdraw everything (disregarding active orders).

## User Story

Users with active TWAP/stop-loss orders in their Safe vault need clear options when withdrawing: either withdraw only funds not committed to orders, or explicitly choose to withdraw everything (understanding it may break active orders).

## Design Constraints

- The tool schema should accept a parameter (e.g., \`ignoreActiveOrders: boolean\`) to let the user choose
- The system prompt should instruct the LLM to ask the user which approach they want if not specified
- The deposit flow in \`safeVaultDeposit.ts\` already has the committed amount calculation pattern — reuse it
- This should NOT be a hard block — users may legitimately want to withdraw everything and cancel orders separately

## Context & Findings

- \`safeVaultDeposit.ts:36-45\` already calculates \`committedAmount\` by filtering \`walletContext.registryOrders\` for active orders on the same chain and summing their \`sellAmountBaseUnit\` — this is the reference implementation
- \`vaultWithdraw.ts:50\` calls \`validateSufficientBalance\` but never checks committed amounts
- \`vaultWithdrawAll.ts\` builds transfer transactions for the full balance of every token with no committed amount check
- The \`walletContext.registryOrders\` array contains \`{ sellTokenAddress, sellAmountBaseUnit, status, chainId }\` for all registered orders
- Active order statuses to filter for: \`'open'\` (same filter used in \`safeVaultDeposit.ts:38\`)

## Files

- \`apps/agentic-server/src/tools/vault/vaultWithdraw.ts\` — add \`ignoreActiveOrders\` to schema, compute committed amount for the requested token, subtract from available balance (or skip if \`ignoreActiveOrders: true\`), include warning in output when committed funds exist
- \`apps/agentic-server/src/tools/vault/vaultWithdrawAll.ts\` — same pattern: add \`ignoreActiveOrders\` to schema, subtract committed amounts per token from withdrawal amounts, include per-token warnings
- \`apps/agentic-server/src/utils/safeVaultDeposit.ts\` — reference for committed amount calculation pattern (lines 36-45); consider extracting \`getCommittedAmount\` as a reusable utility
- \`apps/agentic-server/src/routes/chat.ts\` — update system prompt vault section to instruct the LLM: when user requests a withdrawal and has active orders, ask whether they want to withdraw only excess funds or everything

## Acceptance Criteria

- [x] \`vaultWithdrawSchema\` and \`vaultWithdrawAllSchema\` accept optional \`ignoreActiveOrders\` boolean parameter
- [x] When \`ignoreActiveOrders\` is false/undefined, committed amounts are subtracted from available balance
- [x] When \`ignoreActiveOrders\` is true, full balance is withdrawn (current behavior)
- [x] Output includes a \`warnings\` field listing any active orders that would be affected
- [x] System prompt instructs agent to ask user preference when active orders exist and user doesn't specify
- [x] Committed amount calculation reuses the pattern from \`safeVaultDeposit.ts\`
- [x] Withdraw of a token with zero excess (all committed) throws a clear error when \`ignoreActiveOrders\` is false
- [x] Lint and type-check pass

## Gotchas

- \`committedAmount\` in \`safeVaultDeposit.ts\` filters by \`sellTokenAddress\` match — for withdraw, you need to match the token being withdrawn against the \`sellTokenAddress\` of active orders
- \`vaultWithdrawAll\` operates across multiple tokens — need per-token committed amount calculation
- The registry orders use lowercase addresses — normalize before comparing
- Native tokens won't have active orders (CoW doesn't support native sell assets) so committed amount will always be 0 for native tokens

## Acceptance Criteria

- [x] vaultWithdrawSchema and vaultWithdrawAllSchema accept optional ignoreActiveOrders boolean\n- [x] When ignoreActiveOrders is false/undefined, committed amounts subtracted from available balance\n- [x] When ignoreActiveOrders is true, full balance withdrawn (current behavior)\n- [x] Output includes warnings field listing affected active orders\n- [x] System prompt instructs agent to ask user preference when active orders exist\n- [x] Committed amount calculation reuses safeVaultDeposit.ts pattern\n- [x] Zero excess throws clear error when ignoreActiveOrders is false\n- [x] Lint and type-check pass
