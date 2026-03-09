import { isEthereumWallet } from '@dynamic-labs/ethereum'
import { isSolanaWallet } from '@dynamic-labs/solana'
import type { SwitchNetworkOutput } from '@shapeshiftoss/agentic-server'

import { networkNameToChainId } from '@/lib/chains'

import { useExecuteOnce } from './useExecuteOnce'
import { useToolExecution } from './useToolExecution'

type NetworkSwitchPhase = 'idle' | 'switching' | 'success' | 'error'

interface NetworkSwitchMeta {
  network?: string
  phase: NetworkSwitchPhase
}

interface UseNetworkSwitchResult {
  phase: NetworkSwitchPhase
  error?: string
}

export const useNetworkSwitch = (
  toolCallId: string,
  networkData: SwitchNetworkOutput | null
): UseNetworkSwitchResult => {
  const ctx = useToolExecution<NetworkSwitchMeta>(toolCallId, 'network_switch', {
    phase: 'idle',
  })

  useExecuteOnce(ctx, networkData, async (data, ctx) => {
    const { refs } = ctx

    const targetChainId = networkNameToChainId[data.network]

    if (!targetChainId) {
      ctx.setState(draft => {
        draft.error = `Network "${data.network}" not found`
        draft.meta.phase = 'error'
        draft.meta.network = data.network
      })
      ctx.markTerminal()
      ctx.persist()
      return
    }

    // Solana doesn't need network switching in the same way, but we might need to switch primary wallet
    if (data.network === 'solana') {
      if (refs.solanaWallet.current && refs.primaryWallet.current && !isSolanaWallet(refs.primaryWallet.current)) {
        await refs.changePrimaryWallet.current(refs.solanaWallet.current.id)
      }

      ctx.setState(draft => {
        draft.meta.phase = 'success'
        draft.meta.network = data.network
      })
      ctx.advanceStep()
      ctx.markTerminal()
      ctx.persist()
      return
    }

    ctx.setState(draft => {
      draft.meta.phase = 'switching'
      draft.meta.network = data.network
      draft.error = undefined
    })

    try {
      // If primary wallet is Solana, switch to EVM first
      if (refs.evmWallet.current && refs.primaryWallet.current && !isEthereumWallet(refs.primaryWallet.current)) {
        await refs.changePrimaryWallet.current(refs.evmWallet.current.id)
      }

      if (!refs.evmWallet.current) {
        throw new Error('EVM wallet not connected')
      }

      await refs.evmWallet.current.connector.switchNetwork({ networkChainId: targetChainId })
      ctx.setState(draft => {
        draft.meta.phase = 'success'
      })
      ctx.advanceStep()
      ctx.markTerminal()
      ctx.persist()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      ctx.setState(draft => {
        draft.meta.phase = 'error'
        draft.error = errorMessage
      })
      ctx.markTerminal()
      ctx.persist()
    }
  })

  return {
    phase: ctx.state.meta.phase,
    error: ctx.state.error,
  }
}
