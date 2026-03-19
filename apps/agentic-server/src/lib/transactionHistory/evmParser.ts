import type { Network, ParsedTransaction, TokenTransfer } from '@shapeshiftoss/types'
import { networkToChainIdMap, networkToNativeAssetId, networkToNativeSymbol } from '@shapeshiftoss/types'
import { AssetService, fromBaseUnit } from '@shapeshiftoss/utils'

import { EVM_NATIVE_DECIMALS, KNOWN_SWAP_SELECTORS, PRECISION_HIGH } from './constants'
import type { EvmTx } from './schemas'
import { createAssetId } from './transactionUtils'

interface NetTransfer {
  contract: string
  symbol: string
  decimals?: number
  netAmount: bigint
  from: string
  to: string
}

function calculateNetTransfers(tx: EvmTx, userAddress: string): NetTransfer[] {
  const normalizedUserAddress = userAddress.toLowerCase()
  const netPositions = new Map<
    string,
    { sent: bigint; received: bigint; symbol: string; decimals?: number; from: string; to: string }
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

function sumInternalNativeTransfers(
  tx: EvmTx,
  userAddress: string
): { receivedInternal: bigint; sentInternal: bigint } {
  let receivedInternal = 0n
  let sentInternal = 0n
  const normalized = userAddress.toLowerCase()

  for (const itx of tx.internalTxs ?? []) {
    const value = BigInt(itx.value)
    if (value === 0n) continue
    if (itx.to.toLowerCase() === normalized) receivedInternal += value
    if (itx.from.toLowerCase() === normalized) sentInternal += value
  }

  return { receivedInternal, sentInternal }
}

function determineTransactionType(tx: EvmTx, userAddress: string): ParsedTransaction['type'] {
  const normalizedUserAddress = userAddress.toLowerCase()
  const normalizedFrom = tx.from.toLowerCase()
  const normalizedTo = tx.to.toLowerCase()

  const netTransfers = calculateNetTransfers(tx, userAddress)
  const hasNativeValue = BigInt(tx.value) > 0n
  const userSentNative = hasNativeValue && normalizedFrom === normalizedUserAddress
  const userReceivedNative = hasNativeValue && normalizedTo === normalizedUserAddress

  const { receivedInternal, sentInternal } = sumInternalNativeTransfers(tx, userAddress)
  const userReceivedNativeInternal = receivedInternal > 0n
  const userSentNativeInternal = sentInternal > 0n

  if (netTransfers.length > 0 || userSentNative || userSentNativeInternal) {
    const hasNegative = netTransfers.some(t => t.netAmount < 0n) || userSentNative || userSentNativeInternal
    const hasPositive = netTransfers.some(t => t.netAmount > 0n) || userReceivedNative || userReceivedNativeInternal

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

  if (tx.inputData && tx.inputData.length >= 10) {
    const selector = tx.inputData.slice(0, 10).toLowerCase()
    if (KNOWN_SWAP_SELECTORS.has(selector)) return 'swap'
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

  if (type === 'swap' && (netTransfers.length > 0 || tx.internalTxs?.length)) {
    const sortedTransfers = netTransfers.sort((a, b) => {
      if (a.netAmount < 0n && b.netAmount > 0n) return -1
      if (a.netAmount > 0n && b.netAmount < 0n) return 1
      return 0
    })

    tokenTransfers = sortedTransfers.map(transfer => {
      const assetId = createAssetId(chainId, transfer.contract, true)
      const decimals = transfer.decimals ?? PRECISION_HIGH
      const amount = fromBaseUnit(transfer.netAmount.toString(), decimals)

      return {
        symbol: transfer.symbol,
        amount,
        decimals,
        from: transfer.netAmount < 0n ? userAddress : transfer.from,
        to: transfer.netAmount > 0n ? userAddress : transfer.to,
        contract: transfer.contract,
        assetId,
        icon: AssetService.getIcon(assetId),
      }
    })

    const hasNativeValue = BigInt(tx.value) > 0n && normalizedFrom === normalizedUserAddress
    const hasNegativeToken = sortedTransfers.some(t => t.netAmount < 0n)
    const hasPositiveToken = sortedTransfers.some(t => t.netAmount > 0n)
    const nativeAssetId = networkToNativeAssetId[network]
    const nativeSymbol = networkToNativeSymbol[network]
    const { receivedInternal, sentInternal } = sumInternalNativeTransfers(tx, userAddress)

    if (hasNativeValue && !hasNegativeToken) {
      tokenTransfers = [
        {
          symbol: nativeSymbol,
          amount: fromBaseUnit(tx.value, EVM_NATIVE_DECIMALS),
          decimals: EVM_NATIVE_DECIMALS,
          from: userAddress,
          to: tx.to,
          assetId: nativeAssetId,
          icon: AssetService.getIcon(nativeAssetId),
        },
        ...tokenTransfers,
      ]
    }

    if (receivedInternal > 0n && !hasPositiveToken) {
      tokenTransfers = [
        ...(tokenTransfers ?? []),
        {
          symbol: nativeSymbol,
          amount: fromBaseUnit(receivedInternal.toString(), EVM_NATIVE_DECIMALS),
          decimals: EVM_NATIVE_DECIMALS,
          from: tx.to,
          to: userAddress,
          assetId: nativeAssetId,
          icon: AssetService.getIcon(nativeAssetId),
        },
      ]
    }

    if (sentInternal > 0n && !hasNegativeToken && !hasNativeValue) {
      tokenTransfers = [
        {
          symbol: nativeSymbol,
          amount: `-${fromBaseUnit(sentInternal.toString(), EVM_NATIVE_DECIMALS)}`,
          decimals: EVM_NATIVE_DECIMALS,
          from: userAddress,
          to: tx.to,
          assetId: nativeAssetId,
          icon: AssetService.getIcon(nativeAssetId),
        },
        ...(tokenTransfers ?? []),
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
            const assetId = createAssetId(chainId, transfer.contract, true)
            const decimals = transfer.decimals ?? PRECISION_HIGH

            return {
              symbol: transfer.symbol,
              amount: fromBaseUnit(transfer.value, decimals),
              decimals,
              from: transfer.from,
              to: transfer.to,
              contract: transfer.contract,
              assetId,
              icon: AssetService.getIcon(assetId),
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
      tokenTransfers: tokenTransfers ?? [],
    }
  }

  return {
    ...baseTransaction,
    type,
    tokenTransfers,
  }
}
