import type { SwitchNetworkOutput } from '@shapeshiftoss/agentic-server'
import type { AppKitNetwork } from '@reown/appkit/networks'
import { arbitrum, avalanche, base, bsc, gnosis, mainnet, optimism, polygon, solana } from '@reown/appkit/networks'
import { modal } from '@reown/appkit/react'

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

export const useNetworkSwitch = (toolCallId: string, networkData: SwitchNetworkOutput | null): UseNetworkSwitchResult => {
  const { state } = useToolExecutionEffect(
    toolCallId,
    networkData,
    initialNetworkState,
    (_data, state) => state.phase === 'idle' && !!modal,
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
        })
        .catch((error: Error) => {
          setState(draft => {
            draft.phase = 'error'
            draft.error = error.message
          })
        })
    },
    [modal]
  )

  return {
    phase: state.phase,
    error: state.error,
  }
}
