import { useAssistantTool } from '@assistant-ui/react'
import { useWalletClient } from 'wagmi'
import z from 'zod'

import { switchEvmChainParams, switchEvmChain } from '@/tools/switchEvmChain'

// Weather tool params
const weatherParams = z.object({
  location: z.string().describe('The location to get weather for'),
})

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

  useAssistantTool({
    toolName: 'getWeather',
    description: 'Gets the current weather for a location',
    parameters: weatherParams,
    execute: async ({ location }) => {
      console.log('Frontend weather tool called with location:', location)
      // Simulate a brief delay like a real API call
      await new Promise(resolve => setTimeout(resolve, 500))
      return `The weather in ${location} is 10 degrees and sunny.`
    },
  })

  return null
}

export default useTools
