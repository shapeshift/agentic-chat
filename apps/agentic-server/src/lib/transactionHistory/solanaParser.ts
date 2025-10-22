import { fromBaseUnit } from '@shapeshiftoss/utils'
import axios from 'axios'
import { z } from 'zod'

import { SOLANA_NATIVE_DECIMALS } from './constants'
import { solanaTxSchema } from './schemas'
import type { SolanaTx } from './schemas'
import type { ParsedTransaction, TokenTransfer } from './types'

function determineTransactionType(
  nativeTransfer: SolanaTx['nativeTransfers'] extends (infer U)[] | undefined ? U | undefined : never,
  userAddress: string,
  tokenTransfersCount: number
): ParsedTransaction['type'] {
  if (tokenTransfersCount > 1) {
    return 'swap'
  }

  if (nativeTransfer) {
    if (nativeTransfer.fromUserAccount === userAddress) {
      return 'send'
    }
    if (nativeTransfer.toUserAccount === userAddress) {
      return 'receive'
    }
  }

  return 'contract'
}

export function parseSolanaTransaction(tx: SolanaTx, userAddress: string): ParsedTransaction {
  const nativeTransfer = tx.nativeTransfers?.[0]

  const tokenTransfers: TokenTransfer[] | undefined =
    tx.tokenTransfers && tx.tokenTransfers.length > 0
      ? tx.tokenTransfers
          .filter(transfer => transfer.amount !== undefined && transfer.amount !== null)
          .map(transfer => ({
            symbol: transfer.token?.symbol || 'Unknown',
            amount: fromBaseUnit(transfer.amount!.toString(), transfer.token?.decimals || 9),
            from: transfer.fromUserAccount || '',
            to: transfer.toUserAccount || '',
          }))
      : undefined

  let from = tx.feePayer
  let to = tx.feePayer
  let value = '0'

  if (nativeTransfer) {
    from = nativeTransfer.fromUserAccount
    to = nativeTransfer.toUserAccount
    value = fromBaseUnit(nativeTransfer.amount.toString(), SOLANA_NATIVE_DECIMALS)
  }

  const type = determineTransactionType(nativeTransfer, userAddress, tokenTransfers?.length || 0)

  const baseTransaction = {
    txid: tx.txid,
    timestamp: tx.timestamp,
    blockHeight: tx.blockHeight,
    status: tx.transactionError === null ? ('success' as const) : ('failed' as const),
    value,
    fee: fromBaseUnit(tx.fee.toString(), SOLANA_NATIVE_DECIMALS),
    from,
    to,
  }

  if (type === 'swap') {
    return {
      ...baseTransaction,
      type,
      tokenTransfers: tokenTransfers!,
    }
  }

  return {
    ...baseTransaction,
    type,
    tokenTransfers,
  }
}

export async function fetchSolanaTransactionHistory(
  url: string,
  address: string
): Promise<{ transactions: ParsedTransaction[]; cursor?: string }> {
  try {
    const { data } = await axios.get(url)

    const solanaResponse = z
      .object({
        pubkey: z.string(),
        cursor: z.string().optional(),
        txs: z.array(solanaTxSchema),
      })
      .parse(data)

    const transactions = solanaResponse.txs.map(tx => parseSolanaTransaction(tx, address))

    return {
      transactions,
      cursor: solanaResponse.cursor,
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to fetch Solana transaction history: ${error.message}`)
    }
    throw error
  }
}
