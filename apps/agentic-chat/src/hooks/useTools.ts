import { useAssistantTool } from '@assistant-ui/react'
import { useWalletClient } from 'wagmi'

import { switchEvmChain, switchEvmChainParams } from '../tools/switchEvmChain'

const useTools = () => {
  const { data: walletClient } = useWalletClient()

  useAssistantTool({
    toolName: 'switchEvmChain',
    description: 'Switches the connected wallet to a different EVM chain',
    parameters: switchEvmChainParams,
    execute: async ({ chainId }) => {
      return switchEvmChain({
        walletClient,
        chainId,
      })
    },
  })

  return null
}

export default useTools
