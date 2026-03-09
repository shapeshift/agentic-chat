import type { Network, ParsedTransaction, TokenTransfer } from '@shapeshiftoss/types'
import { networkToChainIdMap } from '@shapeshiftoss/types'
import { AssetService, fromBaseUnit } from '@shapeshiftoss/utils'

import { PRECISION_MEDIUM, SOLANA_NATIVE_DECIMALS } from './constants'
import type { SolanaTx } from './schemas'
import { createAssetId } from './transactionUtils'

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

export function parseSolanaTransaction(tx: SolanaTx, userAddress: string, network: Network): ParsedTransaction {
  const nativeTransfer = tx.nativeTransfers?.[0]
  const chainId = networkToChainIdMap[network]

  const tokenTransfers: TokenTransfer[] | undefined =
    tx.tokenTransfers && tx.tokenTransfers.length > 0
      ? tx.tokenTransfers
          .filter(transfer => transfer.amount !== undefined && transfer.amount !== null)
          .map(transfer => {
            const assetId = createAssetId(chainId, transfer.mint!, false)
            const decimals = transfer.token?.decimals ?? PRECISION_MEDIUM

            return {
              symbol: transfer.token?.symbol || 'Unknown',
              amount: fromBaseUnit(transfer.amount!.toString(), decimals),
              decimals,
              from: transfer.fromUserAccount || '',
              to: transfer.toUserAccount || '',
              contract: transfer.mint,
              assetId,
              icon: AssetService.getInstanceOrNull()?.getAsset(assetId)?.icon,
            }
          })
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
