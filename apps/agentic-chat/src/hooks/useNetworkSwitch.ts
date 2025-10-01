import type { SwitchNetworkOutput } from '@shapeshiftoss/agentic-server'
import { useEffect, useReducer } from 'react'
import { useSwitchChain } from 'wagmi'

import { useExecutedToolCalls } from '@/stores/executedToolCalls'

type NetworkSwitchData = SwitchNetworkOutput

type NetworkSwitchPhase = 'idle' | 'switching' | 'success' | 'error'

interface NetworkSwitchState {
  phase: NetworkSwitchPhase
  error?: string
}

type NetworkSwitchAction =
  | { type: 'START_SWITCH' }
  | { type: 'SWITCH_SUCCESS' }
  | { type: 'ERROR'; error: string }

const initialState: NetworkSwitchState = {
  phase: 'idle',
}

function networkSwitchReducer(state: NetworkSwitchState, action: NetworkSwitchAction): NetworkSwitchState {
  switch (action.type) {
    case 'START_SWITCH':
      return {
        ...state,
        phase: 'switching',
        error: undefined,
      }
    case 'SWITCH_SUCCESS':
      return {
        ...state,
        phase: 'success',
      }
    case 'ERROR':
      return {
        ...state,
        phase: 'error',
        error: action.error,
      }
    default:
      return state
  }
}

interface UseNetworkSwitchResult {
  phase: NetworkSwitchPhase
  error?: string
}

export const useNetworkSwitch = (toolCallId: string, networkData: NetworkSwitchData | null): UseNetworkSwitchResult => {
  const [state, dispatch] = useReducer(networkSwitchReducer, initialState)
  const { switchChain } = useSwitchChain()
  const { hasExecuted, markExecuted } = useExecutedToolCalls()

  useEffect(() => {
    if (!networkData || state.phase !== 'idle' || !switchChain) {
      return
    }

    if (hasExecuted(toolCallId)) {
      return
    }

    markExecuted(toolCallId)

    const executeNetworkSwitch = async () => {
      try {
        dispatch({ type: 'START_SWITCH' })

        await switchChain({ chainId: networkData.chainId })

        dispatch({ type: 'SWITCH_SUCCESS' })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        dispatch({ type: 'ERROR', error: errorMessage })
      }
    }

    executeNetworkSwitch()
  }, [networkData, state.phase, switchChain])

  return {
    phase: state.phase,
    error: state.error,
  }
}
