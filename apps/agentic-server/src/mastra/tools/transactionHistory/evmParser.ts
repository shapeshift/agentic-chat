import { fromBaseUnit } from '@shapeshiftoss/utils'
import axios from 'axios'
import z from 'zod'

import { EVM_NATIVE_DECIMALS } from './constants'
import { evmTxSchema } from './schemas'
import type { EvmTx } from './schemas'
import type { ParsedTransaction, TokenTransfer } from './types'

function determineTransactionType(tx: EvmTx, userAddress: string): ParsedTransaction['type'] {
  const normalizedUserAddress = userAddress.toLowerCase()
  const normalizedFrom = tx.from.toLowerCase()
  const normalizedTo = tx.to.toLowerCase()

  if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
    const uniqueTokens = new Set(tx.tokenTransfers.map(t => t.contract))
    if (uniqueTokens.size > 1) {
      return 'swap'
    }
  }

  if (tx.inputData && tx.inputData !== '0x' && normalizedTo !== normalizedUserAddress) {
    return 'contract'
  }

  if (normalizedTo === normalizedUserAddress) {
    return 'receive'
  }

  if (normalizedFrom === normalizedUserAddress) {
    return 'send'
  }

  return 'contract'
}

export function parseEvmTransaction(tx: EvmTx, userAddress: string): ParsedTransaction {
  const tokenTransfers: TokenTransfer[] | undefined =
    tx.tokenTransfers && tx.tokenTransfers.length > 0
      ? tx.tokenTransfers.map(transfer => ({
          symbol: transfer.symbol,
          amount: fromBaseUnit(transfer.value, transfer.decimals),
          from: transfer.from,
          to: transfer.to,
        }))
      : undefined

  const type = determineTransactionType(tx, userAddress)

  const baseTransaction = {
    txid: tx.txid,
    timestamp: tx.timestamp,
    blockHeight: tx.blockHeight,
    status: tx.status === 1 ? ('success' as const) : ('failed' as const),
    value: fromBaseUnit(tx.value, EVM_NATIVE_DECIMALS),
    fee: fromBaseUnit(tx.fee, EVM_NATIVE_DECIMALS),
    from: tx.from,
    to: tx.to,
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

export async function fetchEvmTransactionHistory(
  url: string,
  address: string
): Promise<{ transactions: ParsedTransaction[]; cursor?: string }> {
  try {
    const { data } = await axios.get(url)

    const evmResponse = z
      .object({
        pubkey: z.string(),
        cursor: z.string().optional(),
        txs: z.array(evmTxSchema),
      })
      .parse(data)

    const transactions = evmResponse.txs.map(tx => parseEvmTransaction(tx, address))

    return {
      transactions,
      cursor: evmResponse.cursor,
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to fetch EVM transaction history: ${error.message}`)
    }
    throw error
  }
}
