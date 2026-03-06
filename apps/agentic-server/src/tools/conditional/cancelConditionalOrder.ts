import { buildRemoveConditionalOrderTx } from '../../lib/composableCow'
import { NETWORK_TO_CHAIN_ID } from '../../lib/cow/types'
import { getSafeAddressForChain, isSafeReadyOnChain } from '../../utils/walletContextSimple'
import type { WalletContext } from '../../utils/walletContextSimple'

export interface CancelConditionalOrderInput {
  orderHash: string
  network: 'ethereum' | 'gnosis' | 'arbitrum'
}

export interface CancelConditionalOrderOutput {
  safeTransaction: { to: string; data: string; value: string; chainId: number }
  safeAddress: string
  orderHash: string
  message: string
}

export async function executeCancelConditionalOrder(
  input: CancelConditionalOrderInput,
  orderType: 'stop-loss' | 'TWAP/DCA',
  walletContext?: WalletContext
): Promise<CancelConditionalOrderOutput> {
  const chainId = NETWORK_TO_CHAIN_ID[input.network]!
  const safeAddress = await getSafeAddressForChain(walletContext, chainId)
  if (!safeAddress) {
    throw new Error(`No Safe smart account found. Cannot cancel ${orderType} without a Safe wallet.`)
  }
  if (!isSafeReadyOnChain(walletContext, chainId)) {
    throw new Error(
      `Safe is not deployed on ${input.network}. Cannot cancel ${orderType} on a chain where the Safe doesn't exist.`
    )
  }

  const safeTransaction = buildRemoveConditionalOrderTx(input.orderHash as `0x${string}`)

  return {
    safeTransaction: { ...safeTransaction, chainId },
    safeAddress,
    orderHash: input.orderHash,
    message: `Cancel transaction prepared. This will remove the ${orderType} order from ComposableCoW on-chain.`,
  }
}
