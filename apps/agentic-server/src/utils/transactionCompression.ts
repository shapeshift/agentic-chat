import { gzipSync } from 'zlib'

/**
 * Compress transaction data for storage/transport
 */
export function compressTransactionData(data: string): string {
  return gzipSync(Buffer.from(data, 'utf8')).toString('base64')
}

/**
 * Type-safe helper to create compressed transaction data
 */
export function createCompressedTransaction(tx: {
  chainId: string | number
  data: string
  from: string
  to: string
  value: string
  gasLimit?: string
}) {
  return {
    chainId: String(tx.chainId),
    data: compressTransactionData(tx.data || ''),
    from: tx.from,
    to: tx.to,
    value: tx.value,
    ...(tx.gasLimit && { gasLimit: tx.gasLimit }),
  }
}
