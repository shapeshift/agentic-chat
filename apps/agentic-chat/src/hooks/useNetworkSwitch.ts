import type { AppKitNetwork } from '@reown/appkit/networks'
import { arbitrum, avalanche, base, bsc, gnosis, mainnet, optimism, polygon, solana } from '@reown/appkit/networks'
import { modal } from '@reown/appkit/react'
import type { SwitchNetworkOutput } from '@shapeshiftoss/agentic-server'
import { useEffect, useRef } from 'react'

import { useChatContext } from '@/providers/ChatProvider'
import type { PersistedToolState } from '@/stores/chatStore'
import { useChatStore } from '@/stores/chatStore'

import { useToolExecutionEffect } from './useToolExecutionEffect'

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

const networkMap: Record<string, AppKitNetwork> = {
  ethereum: mainnet,
  arbitrum,
  polygon,
  optimism,
  base,
  avalanche,
  bsc,
  gnosis,
  solana,
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

  const { state } = useToolExecutionEffect(toolCallId, networkData, initialNetworkState, (data, setState) => {
    const targetNetwork = networkMap[data.network]

    if (!targetNetwork) {
      setState(draft => {
        draft.phase = 'error'
        draft.error = `Network "${data.network}" not found`
      })
      return
    }

    setState(draft => {
      draft.phase = 'switching'
      draft.error = undefined
    })

    modal
      ?.switchNetwork(targetNetwork)
      .then(() => {
        setState(draft => {
          draft.phase = 'success'
        })
        if (activeConversationId) {
          const persisted = networkStateToPersistedState(
            toolCallId,
            { phase: 'success' },
            activeConversationId,
            data.network,
            data
          )
          store.persistTransaction(persisted)
        }
      })
      .catch((error: Error) => {
        const errorMessage = error.message
        setState(draft => {
          draft.phase = 'error'
          draft.error = errorMessage
        })
        if (activeConversationId) {
          const persisted = networkStateToPersistedState(
            toolCallId,
            { phase: 'error', error: errorMessage },
            activeConversationId,
            data.network,
            data
          )
          store.persistTransaction(persisted)
        }
      })
  })

  return {
    phase: state.phase,
    error: state.error,
  }
}
