---
id: sa3-gbzn
status: closed
deps: []
links: []
created: 2026-03-08T23:28:44Z
type: feature
priority: 2
assignee: Jibles
---
# Transaction Preview/Simulation for Agentic Chat

## Problem

Transactions in the agentic chat go directly from quote → wallet signature → on-chain execution with **no simulation or preview step**. Users have no way to verify what a transaction will do before signing. This creates several issues:

- **Silent reverts** — users pay gas for transactions that fail on-chain with no prior warning
- **Inaccurate gas estimates** — hardcoded gas limits (21k native, 65k ERC20 in `feeEstimation.ts`) don't reflect actual execution cost
- **No balance-change preview** — users can't see the net effect of a transaction before committing
- **Trust gap** — competing products (MetaMask, Rabby, Safe) all show simulation results; we don't

## Current Architecture

### Transaction flow
1. Server tools (`initiateSwap.ts`, `send.ts`) build unsigned transactions
2. Frontend hooks (`useSwapExecution.tsx`, `useSendExecution.ts`) orchestrate execution phases
3. `transactionRegistry.ts` dispatches to chain-specific executors (EVM via viem/wagmi, Solana via web3.js)
4. UI components (`InitiateSwapUI.tsx`, `SendUI.tsx`) show step-by-step progress
5. `waitForConfirmedReceipt.ts` polls for on-chain confirmation

### What's missing
- No `eth_estimateGas` or `eth_call` dry-runs anywhere
- No simulation API integration (Tenderly, Blowfish, etc.)
- No preview UI step between "here's the quote" and "sign this"
- Gas limits come from DEX aggregator quotes (Bebop/Relay) or hardcoded constants
- Safe transactions (`executeSafeTransaction.ts`) have a separate path with no simulation either

### Key files
- `apps/agentic-server/src/utils/feeEstimation.ts` — hardcoded gas constants
- `apps/agentic-server/src/utils/transactionHelpers.ts` — tx builders
- `apps/agentic-chat/src/utils/chains/evm/transaction.ts` — EVM execution
- `apps/agentic-chat/src/hooks/useSwapExecution.tsx` — swap orchestration
- `apps/agentic-chat/src/hooks/useSendExecution.ts` — send orchestration

## Tool/API Landscape

### Option A: viem built-ins (`eth_estimateGas` + `eth_call`)
- **What it gives you:** Gas estimation and revert detection using RPCs we already have
- **Pros:** Zero new dependencies, works on every EVM chain, free
- **Cons:** No human-readable balance diffs, no token approval decoding, no trace data
- **Difficulty delta:** Low (+2-3 days). Add `publicClient.estimateGas()` and `publicClient.call()` before execution in the hooks
- **Coverage:** ~60% of the value (catches reverts, accurate gas)

### Option B: Tenderly Simulation API
- **What it gives you:** Full execution trace, state diffs, balance changes, gas usage, decoded events
- **Pros:** Rich data, battle-tested, good DX
- **Cons:** Paid API ($$$), adds external dependency, rate limits, another API key to manage
- **Difficulty delta:** Medium (+4-5 days). New server-side service + API integration + response parsing
- **Coverage:** ~90% of the value

### Option C: Blowfish Transaction Scanning API
- **What it gives you:** Human-readable balance changes, approval warnings, scam/phishing detection
- **Pros:** Purpose-built for wallet UX, includes security warnings, good multi-chain support
- **Cons:** Paid API, less raw trace data than Tenderly, newer/smaller company
- **Difficulty delta:** Medium (+4-5 days). Similar integration effort to Tenderly
- **Coverage:** ~85% of the value, strongest on UX/security

### Option D: Hybrid (viem basics + Blowfish/Tenderly for rich preview)
- **What it gives you:** Fast revert checks via RPC + rich previews for complex txs
- **Pros:** Graceful degradation if paid API is down, best UX
- **Cons:** Two code paths to maintain
- **Difficulty delta:** Medium-High (+5-7 days)
- **Coverage:** ~95%

### Solana considerations
- Solana has native `simulateTransaction` RPC — free and built-in
- Blowfish supports Solana; Tenderly does not
- viem doesn't apply; would need `@solana/web3.js` simulation

### Safe/Smart wallet considerations
- Safe txs use `execTransaction` which wraps the inner call — simulation must target the Safe's `execTransaction`, not the inner tx
- Safe SDK has `estimateGas` helpers but no full simulation
- Tenderly and Blowfish both handle Safe transactions

## Scope considerations for brainstorming

1. **Where does simulation run?** Server-side (keeps API keys private, works for all clients) vs client-side (lower latency, simpler arch)
2. **Blocking vs advisory?** Should a predicted revert block execution or just warn?
3. **Which transaction types?** Swaps and sends are highest priority. CoW protocol orders are off-chain signatures and don't need on-chain simulation.
4. **Cross-chain (Relay)?** Can only simulate the source-chain leg; destination is handled by the relayer
5. **Caching/performance?** Simulations add latency; should we simulate at quote time or at sign time?

## Acceptance Criteria

- [ ] Spec reviewed and approach selected in brainstorming session
- [ ] Implementation plan created with subtasks
- [ ] Tool/API choice validated with cost analysis
