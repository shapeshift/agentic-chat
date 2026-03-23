---
id: sa-sucs
status: closed
deps: []
links: []
created: 2026-03-19T22:55:21Z
type: task
priority: 2
assignee: Jibles
---
# Safe deployment reverts on Arbitrum — gas estimation delegated to wallet without buffer

## Notes

**2026-03-19T22:55:40Z**

## Root Cause Analysis

### Symptom
First-time Safe deployment on Arbitrum reverts with out-of-gas during `createProxyWithNonce` → `setup()` → `setupOwners()`. Only 234K gas allocated; needs ~350K+.

### Reverted Transaction
`0x4e623c1d3085568fb91c6083f506a38d77067d26453e67c2ff13e4dba102d6d0` on Arbitrum.

### Root Cause Chain
1. Safe SDK `createSafeDeploymentTransaction()` returns `{ to, value, data }` with no gas fields
2. Viem `sendTransaction` with JSON-RPC account (from `custom(provider)`) takes the JSON-RPC path — does NOT call `prepareTransactionRequest()` or `estimateGas()` — sends `eth_sendTransaction` directly and relies on the wallet to fill gas
3. ShapeShift native wallet (via WalletConnect) receives tx without gas limit and underestimates at 234K
4. Transaction runs out of gas during Safe initialization

### Why This Doesn't Affect EOA Transactions
EOA txs go through `simulateEvmTransaction()` (simulation.ts:14-26) which calls `publicClient.estimateGas()` + adds 20% buffer. Safe deployment skips this entirely.

### Affected Code
- `apps/agentic-chat/src/lib/safe/safeFactory.ts:94-109` — deployment tx sent without explicit gas

### Fix
Add explicit gas estimation with buffer before sending the Safe deployment transaction in `safeFactory.ts`:
1. Create a `publicClient` from the provider (already done on line 114, move it earlier)
2. Call `publicClient.estimateGas({ to, data, value, account: signerAddress })` on the deployment tx
3. Add 20% buffer (same pattern as `simulation.ts`)
4. Pass `gas: estimatedGas` to `walletClient.sendTransaction()`

### Secondary Issue (separate)
`daemon.gnosis.shapeshift.com` DNS resolution failing — Gnosis Chain RPC is down. Causes `safe-discovery` query to partially fail and triggers React Query "Query data cannot be undefined" warning. Not blocking Arbitrum but breaks Gnosis chain discovery.

### Reproduction
Trigger a TWAP order on Arbitrum with a ShapeShift native wallet (via WalletConnect) that has never deployed a Safe on Arbitrum before.
