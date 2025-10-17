import { fromBaseUnit } from '@shapeshiftoss/utils'
import axios from 'axios'
import z from 'zod'

import { EVM_NATIVE_DECIMALS } from './constants'
import { evmTxSchema } from './schemas'
import type { EvmTx } from './schemas'
import type { ParsedTransaction, TokenTransfer } from './types'

function filterUserTokenTransfers(
  transfers: EvmTx['tokenTransfers'],
  userAddress: string
): TokenTransfer[] | undefined {
  if (!transfers || transfers.length === 0) return undefined

  const normalizedUserAddress = userAddress.toLowerCase()

  const filtered = transfers
    .filter(transfer => {
      const from = transfer.from.toLowerCase()
      const to = transfer.to.toLowerCase()
      return from === normalizedUserAddress || to === normalizedUserAddress
    })
    .map(transfer => ({
      symbol: transfer.symbol,
      amount: fromBaseUnit(transfer.value, transfer.decimals),
      from: transfer.from,
      to: transfer.to,
    }))

  return filtered.length > 0 ? filtered : undefined
}

function determineTransactionType(
  tx: EvmTx,
  userAddress: string,
  tokenTransfers?: TokenTransfer[]
): ParsedTransaction['type'] {
  const normalizedUserAddress = userAddress.toLowerCase()
  const normalizedFrom = tx.from.toLowerCase()
  const normalizedTo = tx.to.toLowerCase()

  if (tokenTransfers && tokenTransfers.length > 0) {
    const uniqueTokens = new Set(tx.tokenTransfers?.map(t => t.contract) || [])
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
  const tokenTransfers = filterUserTokenTransfers(tx.tokenTransfers, userAddress)
  const type = determineTransactionType(tx, userAddress, tokenTransfers)

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
