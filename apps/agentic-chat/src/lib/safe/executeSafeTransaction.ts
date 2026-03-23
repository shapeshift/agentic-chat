import Safe from '@safe-global/protocol-kit'
import { createPublicClient, custom } from 'viem'

import { createSafeProvider } from './types'
import type { SafeProvider } from './types'

// Wait for a tx to be mined so the Safe nonce increments on-chain before
// the queue releases the next transaction. Without this, back-to-back txs
// can read a stale nonce and produce invalid signatures (GS026).
async function waitForTxConfirmation(txHash: string, provider: SafeProvider): Promise<void> {
  const publicClient = createPublicClient({ transport: custom(provider) })
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}`, confirmations: 1 })
  if (receipt.status === 'reverted') throw new Error(`Transaction reverted: ${txHash}`)
}

// Per-(safeAddress, chainId) sequential queue to prevent nonce race conditions.
// Each new tx chains onto the previous promise for that key so Safe nonces
// are consumed one at a time. Different Safes / chains run concurrently.
const queues = new Map<string, Promise<unknown>>()

function enqueue(safeAddress: string, chainId: number, executor: () => Promise<string>): Promise<string> {
  const key = `${safeAddress.toLowerCase()}-${chainId}`
  const prev = queues.get(key) ?? Promise.resolve()
  const next = prev.catch(() => {}).then(() => executor())
  queues.set(key, next)
  void next.finally(() => {
    if (queues.get(key) === next) queues.delete(key)
  })
  return next
}

// Shared utility for executing transactions through a Safe smart account
// Used by stop-loss, future TWAP/DCA, and cancel flows
export function executeSafeTransaction(
  safeAddress: string,
  txData: { to: string; data: string; value: string },
  signerAddress: string,
  chainId: number,
  provider: SafeProvider
): Promise<string> {
  return executeSafeBatchTransaction(safeAddress, [txData], signerAddress, chainId, provider)
}

// Execute multiple transactions as a batch via MultiSend
export function executeSafeBatchTransaction(
  safeAddress: string,
  transactions: Array<{ to: string; data: string; value: string }>,
  signerAddress: string,
  chainId: number,
  provider: SafeProvider
): Promise<string> {
  return enqueue(safeAddress, chainId, async () => {
    // Use composite provider: reads via public RPC, writes via wallet (WalletConnect)
    const compositeProvider = createSafeProvider(chainId, provider)

    const protocolKit = await Safe.init({
      provider: compositeProvider,
      signer: signerAddress,
      safeAddress,
    })

    const publicClient = createPublicClient({ transport: custom(compositeProvider) })
    const connectedChainId = await publicClient.getChainId()
    if (connectedChainId !== chainId) {
      throw new Error(
        `Chain mismatch: wallet is on chain ${connectedChainId} but expected ${chainId}. Switch networks first.`
      )
    }

    const safeTransaction = await protocolKit.createTransaction({
      transactions: transactions.map(tx => ({
        to: tx.to,
        data: tx.data,
        value: tx.value,
      })),
    })

    const signedTx = await protocolKit.signTransaction(safeTransaction)
    const result = await protocolKit.executeTransaction(signedTx)
    const txHash = typeof result === 'string' ? result : result.hash

    await waitForTxConfirmation(txHash, compositeProvider)

    return txHash
  })
}
