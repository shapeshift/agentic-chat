---
id: sa-hhve
status: in_progress
deps: []
links: []
created: 2026-03-17T07:51:16Z
type: bug
priority: 1
assignee: Jibles
---
# TWAP fails on cross-chain first use when Safe exists on different chain

## Objective

When a user has a Safe deployed on Ethereum and tries to create a TWAP order on Arbitrum for the first time, the server-side PREPARE step fails with a Safe address mismatch error before the client-side SAFE_CHECK step (which would auto-deploy the Safe) ever runs. The Safe auto-deployment is never reached because validation fails first.

## Context & Findings

**Root cause (confirmed):** `getSafeAddressForChain()` in `walletContextSimple.ts:81` falls back to `walletContext.safeAddress` when no per-chain entry exists in `safeDeploymentState`. This fallback is the Ethereum Safe address. `verifySafeOwnership()` then predicts the Safe address for Arbitrum using the Safe SDK — but the SDK uses a **different singleton contract** on L2 chains (GnosisSafeL2 at `0x3E5c...`) vs L1 (GnosisSafe at `0xd9Db...`). Different singleton → different proxy init code → different CREATE2 address → mismatch → error.

**Data flow trace:**

1. `discoverSafeOnChain()` (`safeFactory.ts:134-185`) only stores entries for chains where the Safe IS deployed. Undeployed chains get no entry.
2. `useSafeAccount.safeAddress` (`useSafeAccount.ts:90-93`) picks the first stored address (from Ethereum).
3. `ChatProvider.tsx:69-70` sends both `safeAddress` (Ethereum) and `safeDeploymentState` (only Ethereum entry) to the server.
4. Server `getSafeAddressForChain(ctx, 42161)` at `walletContextSimple.ts:81`: `safeDeploymentState[42161]` is undefined → falls back to `safeAddress` (Ethereum address `0xA`).
5. `verifySafeOwnership("0xA", owner, 42161)` at `safeAddressVerification.ts:20-29`: Safe not deployed on Arb (code === '0x') → predicts address on Arb → gets `0xB` (different due to L2 singleton) → throws.
6. The TWAP stepper Step 2 (SAFE_CHECK in `useConditionalOrderExecution.tsx:158-159`) which calls `ensureSafeReady()` → `deploySafe()` never executes because Step 0 (PREPARE) already failed.

**Reproduction:** Connect wallet with an Ethereum-only Safe. Request a TWAP order on Arbitrum. Observe the "Safe vault address doesn't match" error.

**Rejected approaches:**
- Always using L1 singleton on all chains — would break existing L2 Safes and lose L2-specific event emission
- Skipping verification for undeployed Safes — weakens the security check that prevents address spoofing

## Files

- `apps/agentic-server/src/utils/walletContextSimple.ts` — `getSafeAddressForChain()` line 81: the fallback logic that uses wrong cross-chain address. When no per-chain entry exists, should predict the address for the target chain using `predictSafeAddress(ownerAddress, chainId)` instead of falling back to the top-level `safeAddress`
- `apps/agentic-server/src/utils/safeAddressVerification.ts` — `verifySafeOwnership()`: the verification that catches the mismatch (no change needed here, it's working correctly)
- `apps/agentic-server/src/utils/predictSafeAddress.ts` — server-side prediction function, already exists and can be reused in the fix
- `apps/agentic-chat/src/lib/safe/safeFactory.ts` — client-side `discoverSafeOnChain()` line 163: only stores deployed chains (reference, may not need change)
- `apps/agentic-chat/src/hooks/useSafeAccount.ts` — `safeAddress` derivation at line 90-93 (reference)

## Gotchas

- The server `predictSafeAddress` takes `(ownerAddress, chainId)` — need to extract `ownerAddress` from `walletContext.connectedWallets` in `getSafeAddressForChain` to call it
- `getSafeAddressForChain` is currently async (returns Promise) so adding prediction doesn't change the interface
- The same L1/L2 singleton issue affects stop-loss orders too — they use the same `getSafeAddressForChain` fallback path
- The fix must preserve the security verification: predicted address should still go through `verifySafeOwnership` (which will pass since the predicted address matches itself)
- `predictSafeAddress` has a cache, so repeated calls for the same owner+chain are cheap

## Acceptance Criteria

- [ ] getSafeAddressForChain uses predictSafeAddress(ownerAddress, chainId) instead of walletContext.safeAddress when no per-chain entry exists
- [ ] TWAP creation on Arbitrum works when user only has Ethereum Safe deployed
- [ ] Stop-loss creation on a new chain also works (same code path)
- [ ] Security verification still runs on the predicted address
- [ ] Existing flows (Safe already deployed on target chain) are unaffected
- [ ] Lint and type-check pass
