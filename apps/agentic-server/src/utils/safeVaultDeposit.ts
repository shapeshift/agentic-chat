import { fromAssetId } from '@shapeshiftoss/caip'
import type { Asset } from '@shapeshiftoss/types'
import { fromBaseUnit, toBigInt } from '@shapeshiftoss/utils'
import { encodeFunctionData, erc20Abi } from 'viem'

import { isConditionalOrderActive } from '../lib/composableCow/queries'
import type { TransactionData } from '../lib/schemas/swapSchemas'

import { toChecksumAddress } from './addressValidation'
import { getBalance } from './balanceHelpers'
import { createTransaction } from './transactionHelpers'
import { getAddressForChain } from './walletContextSimple'
import type { WalletContext } from './walletContextSimple'

interface SafeVaultDepositParams {
  walletContext?: WalletContext
  safeAddress: string
  sellAsset: Asset
  sellAmountBaseUnit: string
  evmChainId: number
  sellTokenAddress: string
}

interface SafeVaultDepositResult {
  committedAmount: bigint
  totalNeeded: bigint
  depositAmount: bigint
  depositTx: TransactionData | undefined
  needsDeposit: boolean
}

export async function calculateSafeVaultDeposit(params: SafeVaultDepositParams): Promise<SafeVaultDepositResult> {
  const { walletContext, safeAddress, sellAsset, sellAmountBaseUnit, evmChainId, sellTokenAddress } = params

  let committedAmount = 0n
  const allOrders = (walletContext?.registryOrders ?? []).filter(
    o => o.chainId === evmChainId && o.sellTokenAddress.toLowerCase() === sellTokenAddress.toLowerCase()
  )
  const nowSeconds = Math.floor(Date.now() / 1000)
  const existingOrders = allOrders.filter(o => {
    if (o.status !== 'open') return false
    if (o.validTo > 0 && o.validTo < nowSeconds) return false
    return true
  })

  if (existingOrders.length > 0) {
    const activeResults = await Promise.all(
      existingOrders.map(o => isConditionalOrderActive(safeAddress, o.orderHash as `0x${string}`, evmChainId))
    )
    committedAmount = existingOrders
      .filter((_, i) => activeResults[i])
      .reduce((sum, o) => sum + toBigInt(o.sellAmountBaseUnit), 0n)
  }

  const totalNeeded = committedAmount + toBigInt(sellAmountBaseUnit)

  const eoaAddress = getAddressForChain(walletContext, sellAsset.chainId)
  const safeBalance = await getBalance(safeAddress, sellAsset)
  const safeBalanceBigInt = toBigInt(safeBalance)
  const availableSafeBalance = safeBalanceBigInt > committedAmount ? safeBalanceBigInt - committedAmount : 0n
  const sellAmountBigInt = toBigInt(sellAmountBaseUnit)
  const needsDeposit = availableSafeBalance < sellAmountBigInt
  const depositAmount = needsDeposit ? sellAmountBigInt - availableSafeBalance : 0n

  if (needsDeposit) {
    const eoaBalance = await getBalance(eoaAddress, sellAsset)
    const eoaBalanceBigInt = toBigInt(eoaBalance)

    if (eoaBalanceBigInt < depositAmount) {
      const requiredHuman = fromBaseUnit(sellAmountBaseUnit, sellAsset.precision)
      const safeBalanceHuman = fromBaseUnit(safeBalance, sellAsset.precision)
      const eoaBalanceHuman = fromBaseUnit(eoaBalance, sellAsset.precision)
      throw new Error(
        `Insufficient ${sellAsset.symbol} balance. ` +
          `Required: ${requiredHuman} ${sellAsset.symbol}, ` +
          `Safe balance: ${safeBalanceHuman} (${committedAmount > 0n ? `${fromBaseUnit(committedAmount.toString(), sellAsset.precision)} committed to active orders` : 'none committed'}), ` +
          `Wallet balance: ${eoaBalanceHuman}`
      )
    }
  }

  let depositTx: TransactionData | undefined
  if (needsDeposit) {
    const tokenAddress = fromAssetId(sellAsset.assetId).assetReference
    const transferData = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [toChecksumAddress(safeAddress), depositAmount],
    })

    depositTx = createTransaction({
      chainId: sellAsset.chainId,
      data: transferData,
      from: toChecksumAddress(eoaAddress),
      to: toChecksumAddress(tokenAddress),
      value: '0',
      gasLimit: '65000',
    })
  }

  return { committedAmount, totalNeeded, depositAmount, depositTx, needsDeposit }
}
