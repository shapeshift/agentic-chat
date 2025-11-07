import { toAssetId } from '@shapeshiftoss/caip'
import type { KnownChainIds, Network } from '@shapeshiftoss/types'
import { networkToChainIdMap, networkToNativeAssetId } from '@shapeshiftoss/types'
import { fromBaseUnit, getAssetNamespaceFromChainId } from '@shapeshiftoss/utils'
import axios from 'axios'
import z from 'zod'

import { EVM_NATIVE_DECIMALS } from './constants'
import { evmTxSchema } from './schemas'
import type { EvmTx } from './schemas'

interface NetTransfer {
  contract: string
  symbol: string
  decimals: number
  netAmount: bigint
  from: string
  to: string
}

function calculateNetTransfers(tx: EvmTx, userAddress: string): NetTransfer[] {
  const normalizedUserAddress = userAddress.toLowerCase()
  const netPositions = new Map<
    string,
    { sent: bigint; received: bigint; symbol: string; decimals: number; from: string; to: string }
  >()

  tx.tokenTransfers?.forEach(transfer => {
    const transferFrom = transfer.from.toLowerCase()
    const transferTo = transfer.to.toLowerCase()
    const isUserSender = transferFrom === normalizedUserAddress
    const isUserReceiver = transferTo === normalizedUserAddress

    if (!isUserSender && !isUserReceiver) {
      return
    }

    const position = netPositions.get(transfer.contract) ?? {
      sent: 0n,
      received: 0n,
      symbol: transfer.symbol,
      decimals: transfer.decimals,
      from: transfer.from,
      to: transfer.to,
    }

    if (isUserSender) {
      position.sent += BigInt(transfer.value)
      position.from = transfer.from
    }
    if (isUserReceiver) {
      position.received += BigInt(transfer.value)
      position.to = transfer.to
    }

    netPositions.set(transfer.contract, position)
  })

  const netTransfers: NetTransfer[] = []
  netPositions.forEach((position, contract) => {
    const net = position.received - position.sent
    if (net !== 0n) {
      netTransfers.push({
        contract,
        symbol: position.symbol,
        decimals: position.decimals,
        netAmount: net,
        from: position.from,
        to: position.to,
      })
    }
  })

  return netTransfers
}

function determineTransactionType(tx: EvmTx, userAddress: string): ParsedTransaction['type'] {
  const normalizedUserAddress = userAddress.toLowerCase()
  const normalizedFrom = tx.from.toLowerCase()
  const normalizedTo = tx.to.toLowerCase()

  const netTransfers = calculateNetTransfers(tx, userAddress)
  const hasNativeValue = BigInt(tx.value) > 0n
  const userSentNative = hasNativeValue && normalizedFrom === normalizedUserAddress
  const userReceivedNative = hasNativeValue && normalizedTo === normalizedUserAddress

  if (netTransfers.length > 0 || userSentNative) {
    const hasNegative = netTransfers.some(t => t.netAmount < 0n) || userSentNative
    const hasPositive = netTransfers.some(t => t.netAmount > 0n) || userReceivedNative

    if (hasNegative && hasPositive) {
      return 'swap'
    }

    if (hasPositive && !hasNegative) {
      return 'receive'
    }

    if (hasNegative && !hasPositive) {
      return 'send'
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

export function parseEvmTransaction(tx: EvmTx, userAddress: string, network: Network): ParsedTransaction {
  const type = determineTransactionType(tx, userAddress)
  const netTransfers = calculateNetTransfers(tx, userAddress)
  const normalizedUserAddress = userAddress.toLowerCase()
  const normalizedFrom = tx.from.toLowerCase()
  const chainId = networkToChainIdMap[network]

  let tokenTransfers: TokenTransfer[] | undefined

  if (type === 'swap' && netTransfers.length > 0) {
    const sortedTransfers = netTransfers.sort((a, b) => {
      if (a.netAmount < 0n && b.netAmount > 0n) return -1
      if (a.netAmount > 0n && b.netAmount < 0n) return 1
      return 0
    })

    tokenTransfers = sortedTransfers.map(transfer => {
      const assetNamespace = getAssetNamespaceFromChainId(chainId as KnownChainIds)
      const assetId = toAssetId({ chainId, assetNamespace, assetReference: transfer.contract })

      return {
        symbol: transfer.symbol,
        amount: fromBaseUnit(
          transfer.netAmount < 0n ? (-transfer.netAmount).toString() : transfer.netAmount.toString(),
          transfer.decimals
        ),
        decimals: transfer.decimals,
        from: transfer.netAmount < 0n ? userAddress : transfer.from,
        to: transfer.netAmount > 0n ? userAddress : transfer.to,
        contract: transfer.contract,
        assetId,
      }
    })

    const hasNativeValue = BigInt(tx.value) > 0n && normalizedFrom === normalizedUserAddress
    const hasNegativeToken = sortedTransfers.some(t => t.netAmount < 0n)

    if (hasNativeValue && !hasNegativeToken) {
      tokenTransfers = [
        {
          symbol: 'ETH',
          amount: fromBaseUnit(tx.value, EVM_NATIVE_DECIMALS),
          decimals: EVM_NATIVE_DECIMALS,
          from: userAddress,
          to: tx.to,
          assetId: networkToNativeAssetId[network],
        },
        ...tokenTransfers,
      ]
    }
  } else if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
    const userInvolvedTransfers = tx.tokenTransfers.filter(
      transfer =>
        transfer.from.toLowerCase() === userAddress.toLowerCase() ||
        transfer.to.toLowerCase() === userAddress.toLowerCase()
    )

    tokenTransfers =
      userInvolvedTransfers.length > 0
        ? userInvolvedTransfers.map(transfer => {
            const assetNamespace = getAssetNamespaceFromChainId(chainId as KnownChainIds)
            const assetId = toAssetId({ chainId, assetNamespace, assetReference: transfer.contract })

            return {
              symbol: transfer.symbol,
              amount: fromBaseUnit(transfer.value, transfer.decimals),
              decimals: transfer.decimals,
              from: transfer.from,
              to: transfer.to,
              contract: transfer.contract,
              assetId,
            }
          })
        : undefined
  }

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
  address: string,
  network: Network
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

    const transactions = evmResponse.txs.map(tx => parseEvmTransaction(tx, address, network))

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
