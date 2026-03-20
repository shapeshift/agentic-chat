---
id: tic-94af
status: open
type: bug
priority: 1
assignee: Jibles
links:
    - tic-32f9
created: 2026-03-20T01:50:53.825563135Z
---
# Swap transactions revert on-chain due to unbuffered gas limits from rate providers

## Gotchas

- The simulation runs with unlimited gas (`publicClient.call(params)` at simulation.ts line 17 has no gas param), so it always succeeds even when the provider's gas limit would cause a revert — this is correct behavior, the simulation is checking for logical reverts not gas limits
- `waitForConfirmedReceipt` is async and will add latency to the swap UX — the step should show "Waiting for confirmation..." substatus (same pattern as approval at line 95)
- Don't remove `params.gasLimit` passthrough entirely — it's a useful fallback when simulation fails (line 54-57 catch block)

## Acceptance Criteria

- [ ] When a gasLimit is provided by a rate provider AND the simulation succeeds, use the greater of the two values (provider estimate vs simulation estimate with buffer)
- [ ] Swap transaction on Arbitrum (1 USDC → ETH) no longer reverts due to out-of-gas
- [ ] useSwapExecution calls waitForConfirmedReceipt after swap tx, not just after approval tx
- [ ] Reverted swap transactions show an error state in the UI, not a success toast
- [ ] The fix applies to both Bebop and Relay code paths (both flow through sendEvmTransaction)
- [ ] Lint and type-check pass

