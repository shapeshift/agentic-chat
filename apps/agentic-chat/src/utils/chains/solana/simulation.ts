import type { Connection, VersionedTransaction } from '@solana/web3.js'

import { SimulationError } from '@/utils/SimulationError'

export async function simulateSolanaTransaction(
  transaction: VersionedTransaction,
  connection: Connection
): Promise<void> {
  const result = await connection.simulateTransaction(transaction, {
    sigVerify: false,
    commitment: 'confirmed',
  })

  if (result.value.err) {
    const logs = result.value.logs ?? []
    const errorLog = logs.find(l => {
      const lower = l.toLowerCase()
      return lower.includes('error') || lower.includes('failed')
    })
    const reason = errorLog ?? JSON.stringify(result.value.err)
    throw new SimulationError(reason)
  }
}
