import Safe from '@safe-global/protocol-kit'

// Matches @safe-global/protocol-kit's internal Eip1193Provider (not publicly exported)
type SafeProvider = {
  request: (args: { readonly method: string; readonly params?: readonly unknown[] | object }) => Promise<unknown>
}

function getProvider(): SafeProvider {
  if (!window.ethereum) throw new Error('No ethereum provider found. Please connect your wallet.')
  return window.ethereum as SafeProvider
}

// Shared utility for executing transactions through a Safe smart account
// Used by stop-loss, future TWAP/DCA, and cancel flows
export async function executeSafeTransaction(
  safeAddress: string,
  txData: { to: string; data: string; value: string },
  signerAddress: string
): Promise<string> {
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

  return typeof result === 'string' ? result : result.hash
}

// Execute multiple transactions as a batch via MultiSend
export async function executeSafeBatchTransaction(
  safeAddress: string,
  transactions: Array<{ to: string; data: string; value: string }>,
  signerAddress: string
): Promise<string> {
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

  return typeof result === 'string' ? result : result.hash
}
