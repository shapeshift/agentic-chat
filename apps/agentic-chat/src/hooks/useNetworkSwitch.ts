import type { SwitchNetworkOutput } from '@shapeshiftoss/agentic-server'
import { useEffect } from 'react'
import { useSwitchChain } from 'wagmi'

import { useToolExecutionStore } from '@/stores/toolExecutionStore'

type NetworkSwitchData = SwitchNetworkOutput

type NetworkSwitchPhase = 'idle' | 'switching' | 'success' | 'error'

interface UseNetworkSwitchResult {
  phase: NetworkSwitchPhase
  error?: string
}

export const useNetworkSwitch = (toolCallId: string, networkData: NetworkSwitchData | null): UseNetworkSwitchResult => {
  const state = useToolExecutionStore(s => s.getNetworkState(toolCallId))
  const networkStartSwitch = useToolExecutionStore(s => s.networkStartSwitch)
  const networkSwitchSuccess = useToolExecutionStore(s => s.networkSwitchSuccess)
  const networkSetError = useToolExecutionStore(s => s.networkSetError)
  const hasExecuted = useToolExecutionStore(s => s.hasExecuted(toolCallId))
  const markExecuted = useToolExecutionStore(s => s.markExecuted)
  const { switchChain } = useSwitchChain()

  useEffect(() => {
    if (!networkData || state.phase !== 'idle' || !switchChain) {
      return
    }

    if (hasExecuted) {
      return
    }

    markExecuted(toolCallId)

    const executeNetworkSwitch = () => {
      try {
        networkStartSwitch(toolCallId)

        switchChain({ chainId: networkData.chainId })

        networkSwitchSuccess(toolCallId)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        networkSetError(toolCallId, errorMessage)
      }
    }

    executeNetworkSwitch()
  }, [
    toolCallId,
    networkData,
    state.phase,
    switchChain,
    hasExecuted,
    markExecuted,
    networkStartSwitch,
    networkSwitchSuccess,
    networkSetError,
  ])

  return {
    phase: state.phase,
    error: state.error,
  }
}
