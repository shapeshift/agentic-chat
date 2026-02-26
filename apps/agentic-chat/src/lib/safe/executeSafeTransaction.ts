import Safe from '@safe-global/protocol-kit'
import { createPublicClient, custom } from 'viem'

// Matches @safe-global/protocol-kit's internal Eip1193Provider (not publicly exported)
type SafeProvider = {
  request: (args: { readonly method: string; readonly params?: readonly unknown[] | object }) => Promise<unknown>
}

function getProvider(): SafeProvider {
  if (!window.ethereum) throw new Error('No ethereum provider found. Please connect your wallet.')
  return window.ethereum as SafeProvider
}

// Wait for a tx to be mined so the Safe nonce increments on-chain before
// the queue releases the next transaction. Without this, back-to-back txs
// can read a stale nonce and produce invalid signatures (GS026).
async function waitForTxConfirmation(txHash: string): Promise<void> {
  const publicClient = createPublicClient({ transport: custom(getProvider()) })
  await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}`, confirmations: 1 })
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
  chainId: number
): Promise<string> {
  return enqueue(safeAddress, chainId, async () => {
    const protocolKit = await Safe.init({
      provider: getProvider(),
      signer: signerAddress,
      safeAddress,
    })

    const safeTransaction = await protocolKit.createTransaction({
      transactions: [
        {
          to: txData.to,
          data: txData.data,
          value: txData.value,
        },
      ],
    })

    // For 1-of-1 Safe, sign and execute in one step
    const signedTx = await protocolKit.signTransaction(safeTransaction)
    const result = await protocolKit.executeTransaction(signedTx)
    const txHash = typeof result === 'string' ? result : result.hash

    await waitForTxConfirmation(txHash)

    return txHash
  })
}

// Execute multiple transactions as a batch via MultiSend
export function executeSafeBatchTransaction(
  safeAddress: string,
  transactions: Array<{ to: string; data: string; value: string }>,
  signerAddress: string,
  chainId: number
): Promise<string> {
  return enqueue(safeAddress, chainId, async () => {
    const protocolKit = await Safe.init({
      provider: getProvider(),
      signer: signerAddress,
      safeAddress,
    })

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

    await waitForTxConfirmation(txHash)

    return txHash
  })
}
