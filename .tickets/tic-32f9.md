---
id: tic-32f9
status: open
type: bug
priority: 1
assignee: Jibles
created: 2026-03-19T09:48:16.870745261Z
---
# USDC swap reverts after approval on Arbitrum

## Summary

Swapping USDC -> ETH on Arbitrum fails at the "Sign swap transaction" step after the approval step succeeds. ETH -> USDC swaps work fine.

## Steps to Reproduce

1. Connect with embedded wallet (Dynamic) on Arbitrum
2. Ask agent: "Swap 1 USDC to ETH on Arbitrum"
3. Confirm the Dynamic transaction modal
4. Observe: steps 1-3 (Getting swap quote, Switch to arbitrum, Approve token spending) succeed
5. Step 4 (Sign swap transaction) fails

## Error

`Execution failed: Swap failed: Transaction will revert: Execution reverted for an unknown reason.`

## Expected Behavior

Swap should execute successfully like ETH -> USDC does.

## Notes

- The approval tx goes through on-chain, so the user's USDC allowance is set but the trade never executes
- This appears to be specific to selling ERC-20 tokens (native ETH sells work)
- Could be a slippage, routing, or contract interaction issue
- Tested with wallet `0xD32Bb617c25f33563817A58004F2A441Ff8660F3` holding ~2.32 USDC on Arbitrum

## Acceptance Criteria

- [ ] USDC -> ETH swap executes successfully on Arbitrum
- [ ] Other ERC-20 -> native token swaps work
- [ ] No orphaned approvals left on failed swaps

