import { isEthereumWallet } from '@dynamic-labs/ethereum'
import { useDynamicContext, useSwitchWallet } from '@dynamic-labs/sdk-react-core'
import { isSolanaWallet } from '@dynamic-labs/solana'
import type { SwitchNetworkOutput } from '@shapeshiftoss/agentic-server'
import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'

import { networkNameToChainId } from '@/lib/chains'
import type { PersistedToolState } from '@/stores/chatStore'
import { useChatStore } from '@/stores/chatStore'

import { useToolExecutionEffect } from './useToolExecutionEffect'
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
  const { conversationId: activeConversationId } = useParams<{ conversationId?: string }>()
  const { primaryWallet } = useDynamicContext()
  const changePrimaryWallet = useSwitchWallet()
  const { evmWallet, solanaWallet } = useWalletConnection()

  const evmWalletRef = useRef(evmWallet)
  const solanaWalletRef = useRef(solanaWallet)
  const activeConversationIdRef = useRef(activeConversationId)
  const primaryWalletRef = useRef(primaryWallet)
  evmWalletRef.current = evmWallet
  solanaWalletRef.current = solanaWallet
  activeConversationIdRef.current = activeConversationId
  primaryWalletRef.current = primaryWallet

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
      if (!activeConversationIdRef.current) return
      const persisted = networkStateToPersistedState(toolCallId, finalState, activeConversationIdRef.current, data.network, data)
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
      if (solanaWalletRef.current && primaryWalletRef.current && !isSolanaWallet(primaryWalletRef.current)) {
        await changePrimaryWallet(solanaWalletRef.current.id)
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
      if (evmWalletRef.current && primaryWalletRef.current && !isEthereumWallet(primaryWalletRef.current)) {
        await changePrimaryWallet(evmWalletRef.current.id)
      }

      if (!evmWalletRef.current) {
        throw new Error('EVM wallet not connected')
      }

      await evmWalletRef.current.connector.switchNetwork({ networkChainId: targetChainId })
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
