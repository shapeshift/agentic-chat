import { isEthereumWallet } from '@dynamic-labs/ethereum'
import { isSolanaWallet } from '@dynamic-labs/solana'
import { CHAIN_NAMESPACE, fromChainId } from '@shapeshiftoss/caip'

import type { ExecutionContext } from '@/hooks/useToolExecution'

export async function switchNetworkStep<TMeta extends object>(
  ctx: ExecutionContext<TMeta>,
  chainId: string
): Promise<void> {
  const { chainNamespace, chainReference } = fromChainId(chainId)

  if (chainNamespace !== CHAIN_NAMESPACE.Evm) {
    if (
      chainNamespace === CHAIN_NAMESPACE.Solana &&
      ctx.refs.solanaWallet.current &&
      ctx.refs.primaryWallet.current &&
      !isSolanaWallet(ctx.refs.primaryWallet.current)
    ) {
      await ctx.refs.changePrimaryWallet.current(ctx.refs.solanaWallet.current.id)
    }
    ctx.advanceStep()
    return
  }

  if (!ctx.refs.evmWallet.current) throw new Error('EVM wallet not connected')

  if (ctx.refs.primaryWallet.current && !isEthereumWallet(ctx.refs.primaryWallet.current)) {
    await ctx.refs.changePrimaryWallet.current(ctx.refs.evmWallet.current.id)
  }

  ctx.setSubstatus('Requesting wallet switch...')
  await ctx.refs.evmWallet.current.connector.switchNetwork({ networkChainId: Number(chainReference) })
  ctx.advanceStep()
}

export async function switchNetworkStepByChainIdNumber<TMeta extends object>(
  ctx: ExecutionContext<TMeta>,
  chainIdNumber: number
): Promise<void> {
  if (!ctx.refs.evmWallet.current) throw new Error('EVM wallet not connected')

  if (ctx.refs.primaryWallet.current && !isEthereumWallet(ctx.refs.primaryWallet.current)) {
    await ctx.refs.changePrimaryWallet.current(ctx.refs.evmWallet.current.id)
  }

  ctx.setSubstatus('Requesting wallet switch...')
  await ctx.refs.evmWallet.current.connector.switchNetwork({ networkChainId: chainIdNumber })
  ctx.advanceStep()
}
