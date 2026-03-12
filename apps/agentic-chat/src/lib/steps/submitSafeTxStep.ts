import type { ExecutionContext } from '@/hooks/useToolExecution'
import { executeSafeTransaction } from '@/lib/safe'

interface SafeTxParams {
  safeAddress: string
  to: string
  data: string
  value: string
  chainId: number
}

export async function submitSafeTxStep<TMeta extends object>(
  ctx: ExecutionContext<TMeta>,
  params: SafeTxParams
): Promise<string> {
  if (!ctx.refs.evmWallet.current) throw new Error('EVM wallet not connected')
  if (!ctx.refs.evmAddress.current) throw new Error('Wallet disconnected')

  ctx.setSubstatus('Proposing Safe transaction...')
  const walletClient = await ctx.refs.evmWallet.current.getWalletClient()
  const txHash = await executeSafeTransaction(
    params.safeAddress,
    { to: params.to, data: params.data, value: params.value },
    ctx.refs.evmAddress.current,
    params.chainId,
    walletClient
  )
  ctx.advanceStep()
  return txHash
}
