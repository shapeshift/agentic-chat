---
id: tic-fc5f
status: closed
type: bug
priority: 3
assignee: Jibles
created: 2026-03-19T09:48:57.995716495Z
---
# Portfolio side panel shows stale 'No assets found' state

## Summary

The portfolio side panel (opened by clicking the wallet address button in the nav bar) shows "\$0.00" and "No assets found — Connect a wallet to view your portfolio" even when the wallet IS connected and the portfolio tool returns real balances (\$8.80 USDC + ETH on Arbitrum).

## Additional Issue

The panel occasionally auto-opens during interactions (e.g., when scrolling, or when the wallet button region is inadvertently activated), stealing focus from the chat. This is disruptive during conversations with the agent.

## Steps to Reproduce

1. Connect embedded wallet (0xD32B...60F3)
2. Click the wallet address button in the top-right nav
3. Observe: panel shows \$0.00 and "No assets found"
4. Ask the agent "What is my portfolio balance?"
5. Agent correctly returns \$8.80 — the panel data is stale/wrong

## Expected Behavior

- Panel should show real portfolio balances matching what the portfolio tool returns
- Panel should not auto-open unexpectedly

## Acceptance Criteria

- [ ] Portfolio panel shows correct balances when wallet is connected
- [ ] Panel does not auto-open unexpectedly during chat interactions

