---
id: sa-oygh
status: closed
deps: []
links: []
created: 2026-03-05T01:20:51Z
type: bug
priority: 1
assignee: Jibles
---
# Safe library uses window.ethereum instead of connected wallet provider

## Objective

All Safe library functions (`deploySafe`, `predictSafeAddress`, `enableComposableCowModules`, `executeSafeTransaction`, `executeSafeBatchTransaction`) use `window.ethereum` as the EIP-1193 provider. This breaks every Safe operation for non-injected wallets (WalletConnect, Coinbase Wallet SDK, etc.) because `window.ethereum` points to a different wallet (e.g., MetaMask) than the one the user connected via Dynamic.

## Context & Findings

- **Root cause:** Three files each define a local `getProvider()` that returns `window.ethereum as SafeProvider`. When a user connects via WalletConnect (e.g., Vultisig), Dynamic's connector manages a separate provider — `window.ethereum` is MetaMask (or whatever injected wallet is present).
- **Reproduction:** Connect Vultisig (WalletConnect) in the app while MetaMask is installed. MetaMask is on Arbitrum (chain 42161). Attempt any stop-loss/TWAP/vault operation targeting Ethereum (chain 1). `switchNetwork` correctly switches Vultisig via Dynamic's connector, but `deploySafe` reads `window.ethereum` (MetaMask, still on Arbitrum) and throws: "Provider is on chain 42161 but Safe deployment targets chain 1."
- **Observed:** `window.ethereum isMetaMask: true, isVultisig: undefined`. `evmWallet.connector.name: Vultisig`. `walletClient chainId: 1` (correct). `window.ethereum chainId: 0xa4b1` (wrong).
- **Expected:** Safe operations should use the same provider as the connected Dynamic wallet.
- **Rejected approach:** Polling `eth_chainId` after `switchNetwork` until it matches — doesn't help because `window.ethereum` is a completely different wallet, not a timing issue.
- **Scope:** This affects ALL Safe operations for any non-injected wallet, not just stop-loss.

## Files

- `apps/agentic-chat/src/lib/safe/safeFactory.ts` — remove `getProvider()`, add `provider: SafeProvider` param to `deploySafe` and `predictSafeAddress`
- `apps/agentic-chat/src/lib/safe/safeModules.ts` — remove `getProvider()`, add `provider: SafeProvider` param to `enableComposableCowModules`
- `apps/agentic-chat/src/lib/safe/executeSafeTransaction.ts` — remove `getProvider()`, add `provider: SafeProvider` param to `executeSafeTransaction` and `executeSafeBatchTransaction`
- `apps/agentic-chat/src/lib/safe/index.ts` — export `SafeProvider` type from a shared location
- `apps/agentic-chat/src/hooks/useSafeAccount.ts` — pass provider from Dynamic wallet to `deploySafe`, `enableComposableCowModules`, `predictSafeAddress`
- `apps/agentic-chat/src/hooks/useStopLossExecution.tsx` — pass provider to safe lib calls (also remove debug console.logs added during investigation)
- `apps/agentic-chat/src/hooks/useTwapExecution.tsx` — pass provider to `deploySafe`, `enableComposableCowModules`, `executeSafeTransaction`
- `apps/agentic-chat/src/hooks/useVaultWithdrawExecution.ts` — pass provider to `executeSafeTransaction`
- `apps/agentic-chat/src/hooks/useVaultWithdrawAllExecution.ts` — pass provider to `executeSafeBatchTransaction`

Reference: `evmWallet.getWalletClient()` returns a viem WalletClient whose transport wraps the correct EIP-1193 provider. The `SafeProvider` type is `{ request: (args: { method: string; params?: readonly unknown[] | object }) => Promise<unknown> }`.

## Acceptance Criteria

- [ ] `getProvider()` removed from all three safe lib files
- [ ] `deploySafe`, `predictSafeAddress` accept a `provider` parameter
- [ ] `enableComposableCowModules` accepts a `provider` parameter
- [ ] `executeSafeTransaction`, `executeSafeBatchTransaction` accept a `provider` parameter
- [ ] `SafeProvider` type exported from a single shared location
- [ ] All caller hooks pass the provider obtained from the Dynamic wallet (not `window.ethereum`)
- [ ] `useSafeAccount` hook threads provider through for deploy and enableModules
- [ ] Debug console.logs from investigation removed from `useStopLossExecution.tsx` and `safeFactory.ts`
- [ ] Stop-loss flow works with a WalletConnect wallet (Vultisig) when MetaMask is on a different chain
- [ ] Lint and type-check pass (`pnpm build` in both apps)

## Gotchas

- `useSafeAccount` doesn't currently have access to `evmWallet` directly — it reads `useUserWallets()` from Dynamic. You'll need to get the EthereumWallet from there or accept a provider param in the hook's deploy/enableModules callbacks.
- `predictSafeAddress` is called from `useQuery` in `useSafeAccount` — the provider needs to be available at query time (when `evmAddress` is set).
- The `waitForTxConfirmation` internal function in `executeSafeTransaction.ts` also uses `getProvider()` — needs the same fix.
