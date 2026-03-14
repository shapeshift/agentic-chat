import { ASSET_NAMESPACE, fromAssetId, fromChainId } from '@shapeshiftoss/caip'
import { toBaseUnit } from '@shapeshiftoss/utils'
import { getPublicClient } from '@wagmi/core'
import { erc20Abi, encodeFunctionData } from 'viem'

import { wagmiConfig } from '@/lib/wagmi-config'
import type { SolanaWalletSigner } from '@/utils/chains/types'
import { executeApproval } from '@/utils/swapExecutor'

interface EnsureAllowanceParams {
  sellAssetId: string
  sellAssetChainId: string
  sellAssetPrecision: number
  approvalTarget: string
  sellAmountCryptoPrecision: string
  sellAccount: string
  solanaSigner?: SolanaWalletSigner
}

// Re-checks on-chain allowance and executes approval if needed.
// Returns the approval tx hash if an approval was sent, undefined otherwise.
export async function ensureAllowance(params: EnsureAllowanceParams): Promise<string | undefined> {
  const {
    sellAssetId,
    sellAssetChainId,
    sellAssetPrecision,
    approvalTarget,
    sellAmountCryptoPrecision,
    sellAccount,
    solanaSigner,
  } = params

  const { assetNamespace, assetReference } = fromAssetId(sellAssetId)

  // Native assets (slip44) don't need approval
  if (assetNamespace !== ASSET_NAMESPACE.erc20) return undefined

  const tokenAddress = assetReference as `0x${string}`
  const { chainReference } = fromChainId(sellAssetChainId)
  const chainId = Number(chainReference)

  const publicClient = getPublicClient(wagmiConfig, { chainId })
  if (!publicClient) throw new Error(`No public client for chain ${chainId}`)

  const requiredAmount = BigInt(toBaseUnit(sellAmountCryptoPrecision, sellAssetPrecision))

  const currentAllowance = await publicClient.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [sellAccount as `0x${string}`, approvalTarget as `0x${string}`],
  })

  if (currentAllowance >= requiredAmount) return undefined

  const approveData = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [approvalTarget as `0x${string}`, requiredAmount],
  })

  const approvalTx = {
    chainId: sellAssetChainId,
    data: approveData,
    from: sellAccount,
    to: tokenAddress,
    value: '0',
  }

  return executeApproval(approvalTx, { solanaSigner })
}
