import type { SwitchNetworkOutput } from '@shapeshiftoss/agentic-server'
import { useSwitchChain } from 'wagmi'

import { useToolExecutionEffect } from './useToolExecutionEffect'

type NetworkSwitchData = SwitchNetworkOutput

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

export const useNetworkSwitch = (toolCallId: string, networkData: NetworkSwitchData | null): UseNetworkSwitchResult => {
  const { switchChain } = useSwitchChain()

  const { state } = useToolExecutionEffect(
    toolCallId,
    networkData,
    initialNetworkState,
    (_data, state) => state.phase === 'idle' && !!switchChain,
    (data, setState) => {
      try {
        setState(draft => {
          draft.phase = 'switching'
          draft.error = undefined
        })

        switchChain({ chainId: data.chainId })

        setState(draft => {
          draft.phase = 'success'
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        setState(draft => {
          draft.phase = 'error'
          draft.error = errorMessage
        })
      }
    },
    [switchChain]
  )

  return {
    phase: state.phase,
    error: state.error,
  }
}
