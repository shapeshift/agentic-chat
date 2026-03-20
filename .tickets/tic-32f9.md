---
id: tic-32f9
status: closed
type: bug
priority: 1
assignee: Jibles
links:
    - tic-94af
created: 2026-03-19T09:48:16.870745261Z
---
# USDC swap reverts after approval on Arbitrum

## Expected Behavior

Swap should execute successfully like ETH -> USDC does.

## Acceptance Criteria

- [ ] USDC -> ETH swap executes successfully on Arbitrum
- [ ] Other ERC-20 -> native token swaps work
- [ ] No orphaned approvals left on failed swaps

