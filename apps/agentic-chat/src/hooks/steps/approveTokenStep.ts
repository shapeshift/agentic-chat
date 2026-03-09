import { CHAIN_NAMESPACE, fromChainId } from '@shapeshiftoss/caip'

import type { SolanaWalletSigner } from '@/utils/chains/types'
import { executeApproval } from '@/utils/swapExecutor'
import { waitForConfirmedReceipt } from '@/utils/waitForConfirmedReceipt'

import type { ExecutionContext } from '../useToolExecution'

interface ApproveTokenParams {
  approvalTx: { chainId: string; data: string; from: string; to: string; value: string }
  sellAssetChainId: string
  solanaSigner?: SolanaWalletSigner
}

export async function approveTokenStep<TMeta extends { approvalTxHash?: string }>(
  ctx: ExecutionContext<TMeta>,
  params: ApproveTokenParams
): Promise<string> {
  const { approvalTx, sellAssetChainId, solanaSigner } = params

  const approvalTxHash = await executeApproval(approvalTx, { solanaSigner })

  ctx.setMeta({ approvalTxHash } as Partial<TMeta>)
  ctx.advanceStep()

  // Wait for confirmation (EVM only)
  const { chainNamespace, chainReference } = fromChainId(sellAssetChainId)
  if (chainNamespace === CHAIN_NAMESPACE.Evm) {
    await waitForConfirmedReceipt(Number(chainReference), approvalTxHash as `0x${string}`)
  }

  return approvalTxHash
}
