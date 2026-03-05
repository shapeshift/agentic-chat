import { fromAssetId } from '@shapeshiftoss/caip'
import type { Asset } from '@shapeshiftoss/types'
import { assetService, fromBaseUnit, getFeeAssetIdByChainId, toBigInt } from '@shapeshiftoss/utils'
import { encodeFunctionData, erc20Abi, getAddress } from 'viem'

import { isConditionalOrderActive } from '../lib/composableCow/events'
import type { TransactionData } from '../lib/schemas/swapSchemas'

import { getBalance } from './balanceHelpers'
import { createTransaction } from './transactionHelpers'
import { getAddressForChain } from './walletContextSimple'
import type { WalletContext } from './walletContextSimple'

const WRAPPED_NATIVE_SYMBOLS = new Set(['WETH', 'WXDAI'])

const wethDepositAbi = [
  { type: 'function', name: 'deposit', inputs: [], outputs: [], stateMutability: 'payable' },
] as const

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
  needsWrap: boolean
  wrapTx: TransactionData | undefined
}

export async function calculateSafeVaultDeposit(params: SafeVaultDepositParams): Promise<SafeVaultDepositResult> {
  const { walletContext, safeAddress, sellAsset, sellAmountBaseUnit, evmChainId, sellTokenAddress } = params

  let committedAmount = 0n
  const existingOrders = (walletContext?.registryOrders ?? []).filter(
    o => o.chainId === evmChainId && o.sellTokenAddress.toLowerCase() === sellTokenAddress.toLowerCase()
  )
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

  let needsWrap = false
  let wrapTx: TransactionData | undefined

  if (needsDeposit) {
    const eoaBalance = await getBalance(eoaAddress, sellAsset)
    const eoaBalanceBigInt = toBigInt(eoaBalance)

    if (eoaBalanceBigInt < depositAmount) {
      // Check if this is a wrapped native token and user has enough native balance
      const isWrappedNative = WRAPPED_NATIVE_SYMBOLS.has(sellAsset.symbol.toUpperCase())

      if (isWrappedNative) {
        const nativeFeeAssetId = getFeeAssetIdByChainId(`eip155:${evmChainId}`)
        const nativeStaticAsset = nativeFeeAssetId ? assetService.getAsset(nativeFeeAssetId) : undefined

        if (nativeStaticAsset) {
          const nativeAsset = { ...nativeStaticAsset, network: '', price: '0' }
          const nativeBalance = await getBalance(eoaAddress, nativeAsset)
          const nativeBalanceBigInt = toBigInt(nativeBalance)
          // Amount still needed after using whatever WETH the EOA already has
          const wrapAmount = depositAmount - eoaBalanceBigInt

          if (nativeBalanceBigInt >= wrapAmount) {
            needsWrap = true
            const tokenAddress = fromAssetId(sellAsset.assetId).assetReference
            const wrapData = encodeFunctionData({ abi: wethDepositAbi, functionName: 'deposit' })

            wrapTx = createTransaction({
              chainId: sellAsset.chainId,
              data: wrapData,
              from: getAddress(eoaAddress),
              to: getAddress(tokenAddress),
              value: wrapAmount.toString(),
              gasLimit: '50000',
            })
          } else {
            const requiredHuman = fromBaseUnit(sellAmountBaseUnit, sellAsset.precision)
            const safeBalanceHuman = fromBaseUnit(safeBalance, sellAsset.precision)
            const eoaWrappedHuman = fromBaseUnit(eoaBalance, sellAsset.precision)
            const nativeBalanceHuman = fromBaseUnit(nativeBalance, nativeAsset.precision)
            throw new Error(
              `Insufficient balance. ` +
                `Required: ${requiredHuman} ${sellAsset.symbol}, ` +
                `Safe balance: ${safeBalanceHuman} (${committedAmount > 0n ? `${fromBaseUnit(committedAmount.toString(), sellAsset.precision)} committed to active orders` : 'none committed'}), ` +
                `Wallet ${sellAsset.symbol}: ${eoaWrappedHuman}, ` +
                `Wallet ${nativeAsset.symbol}: ${nativeBalanceHuman}`
            )
          }
        }
      }

      if (!needsWrap) {
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
  }

  let depositTx: TransactionData | undefined
  if (needsDeposit) {
    const tokenAddress = fromAssetId(sellAsset.assetId).assetReference
    const transferData = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [getAddress(safeAddress), depositAmount],
    })

    depositTx = createTransaction({
      chainId: sellAsset.chainId,
      data: transferData,
      from: getAddress(eoaAddress),
      to: getAddress(tokenAddress),
      value: '0',
      gasLimit: '65000',
    })
  }

  return { committedAmount, totalNeeded, depositAmount, depositTx, needsDeposit, needsWrap, wrapTx }
}
