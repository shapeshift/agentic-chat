import type { AppKitNetwork } from '@reown/appkit/networks'
import { arbitrum, avalanche, base, bsc, gnosis, mainnet, optimism, polygon, solana } from '@reown/appkit/networks'
import { modal } from '@reown/appkit/react'
import type { SwitchNetworkOutput } from '@shapeshiftoss/agentic-server'
import { useRef } from 'react'

import type { PersistedToolState } from '@/stores/toolExecutionStore'
import { useToolExecutionStore } from '@/stores/toolExecutionStore'

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
  network: string
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
    phases,
    meta: {
      network,
      ...(state.error && { error: state.error }),
    },
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
  const store = useToolExecutionStore()

  const hasHydratedRef = useRef(false)
  if (!hasHydratedRef.current && !store.toolStates.has(toolCallId)) {
    const persisted = store.getPersistedState(toolCallId)
    if (persisted) {
      const hydratedState = persistedStateToNetworkState(persisted)
      store.initializeState(toolCallId, hydratedState)
      store.markExecuted(toolCallId)
      hasHydratedRef.current = true
    }
  }

  const { state } = useToolExecutionEffect(
    toolCallId,
    networkData,
    initialNetworkState,
    (data, setState) => {
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
          const persisted = networkStateToPersistedState(toolCallId, { phase: 'success' }, data.network)
          store.savePersistedState(persisted)
        })
        .catch((error: Error) => {
          const errorMessage = error.message
          setState(draft => {
            draft.phase = 'error'
            draft.error = errorMessage
          })
          const persisted = networkStateToPersistedState(
            toolCallId,
            { phase: 'error', error: errorMessage },
            data.network
          )
          store.savePersistedState(persisted)
        })
    },
    [modal]
  )

  return {
    phase: state.phase,
    error: state.error,
  }
}
