import { isEthereumWallet } from '@dynamic-labs/ethereum'
import { useDynamicContext, useSwitchWallet } from '@dynamic-labs/sdk-react-core'
import { isSolanaWallet } from '@dynamic-labs/solana'
import type { SwitchNetworkOutput } from '@shapeshiftoss/agentic-server'
import type { PersistedToolState } from '@shapeshiftoss/chat'
import { useChatContext, useChatStore, useToolExecutionEffect } from '@shapeshiftoss/chat'
import { useEffect, useRef } from 'react'

import { networkNameToChainId } from '@/lib/chains'

import { useWalletConnection } from './useWalletConnection'

type NetworkSwitchPhase = 'idle' | 'switching' | 'success' | 'error'

interface NetworkSwitchState {
  phase: NetworkSwitchPhase
  error?: string
}

const initialNetworkState: NetworkSwitchState = {
  phase: 'idle',
}

interface UseNetworkSwitchResult {
  phase: NetworkSwitchPhase
  error?: string
}

function networkStateToPersistedState(
  toolCallId: string,
  state: NetworkSwitchState,
  conversationId: string,
  network: string,
  networkOutput: SwitchNetworkOutput | null
): PersistedToolState {
  const phases: string[] = []

  if (state.phase === 'success') {
    phases.push('network_switched')
  }
  if (state.error) {
    phases.push('error')
  }

  return {
    toolCallId,
    toolType: 'network_switch',
    conversationId,
    timestamp: Date.now(),
    phases,
    meta: {
      network,
      ...(state.error && { error: state.error }),
    },
    ...(networkOutput && { toolOutput: networkOutput }),
  }
}

function persistedStateToNetworkState(persisted: PersistedToolState): NetworkSwitchState {
  if (persisted.phases.includes('network_switched')) {
    return { phase: 'success' }
  }

  if (persisted.meta.error) {
    return { phase: 'error', error: persisted.meta.error as string }
  }

  return { phase: 'idle' }
}

export const useNetworkSwitch = (
  toolCallId: string,
  networkData: SwitchNetworkOutput | null
): UseNetworkSwitchResult => {
  const store = useChatStore()
  const { activeConversationId } = useChatContext()
  const { primaryWallet } = useDynamicContext()
  const changePrimaryWallet = useSwitchWallet()
  const { evmWallet, solanaWallet } = useWalletConnection()

  const hasHydratedRef = useRef(false)
  const lastToolCallIdRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (lastToolCallIdRef.current !== toolCallId) {
      hasHydratedRef.current = false
      lastToolCallIdRef.current = toolCallId
    }

    if (!hasHydratedRef.current && !store.runtimeToolStates.has(toolCallId)) {
      const persisted = store.getPersistedTransaction(toolCallId)
      if (persisted) {
        const hydratedState = persistedStateToNetworkState(persisted)
        store.initializeRuntimeState(toolCallId, hydratedState)
        hasHydratedRef.current = true
      }
    }
  }, [toolCallId, store])

  const { state } = useToolExecutionEffect(toolCallId, networkData, initialNetworkState, async (data, setState) => {
    const persistState = (finalState: NetworkSwitchState) => {
      if (!activeConversationId) return
      const persisted = networkStateToPersistedState(toolCallId, finalState, activeConversationId, data.network, data)
      store.persistTransaction(persisted)
    }

    const targetChainId = networkNameToChainId[data.network]

    if (!targetChainId) {
      const errorState: NetworkSwitchState = { phase: 'error', error: `Network "${data.network}" not found` }
      setState(draft => {
        draft.phase = errorState.phase
        draft.error = errorState.error
      })
      persistState(errorState)
      return
    }

    // Solana doesn't need network switching in the same way, but we might need to switch primary wallet
    if (data.network === 'solana') {
      if (solanaWallet && primaryWallet && !isSolanaWallet(primaryWallet)) {
        await changePrimaryWallet(solanaWallet.id)
      }

      setState(draft => {
        draft.phase = 'success'
      })
      persistState({ phase: 'success' })
      return
    }

    setState(draft => {
      draft.phase = 'switching'
      draft.error = undefined
    })

    try {
      // If primary wallet is Solana, switch to EVM first
      if (evmWallet && primaryWallet && !isEthereumWallet(primaryWallet)) {
        await changePrimaryWallet(evmWallet.id)
      }

      if (!evmWallet) {
        throw new Error('EVM wallet not connected')
      }

      await evmWallet.connector.switchNetwork({ networkChainId: targetChainId })
      setState(draft => {
        draft.phase = 'success'
      })
      persistState({ phase: 'success' })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorState: NetworkSwitchState = { phase: 'error', error: errorMessage }
      setState(draft => {
        draft.phase = errorState.phase
        draft.error = errorState.error
      })
      persistState(errorState)
    }
  })

  return {
    phase: state.phase,
    error: state.error,
  }
}
