import { createTool } from '@mastra/core'
import { networkToChainIdMap } from '@shapeshiftoss/types'

import { switchNetworkInput, switchNetworkOutput } from './schemas/networkSchemas'
import type { SwitchNetworkInput, SwitchNetworkOutput } from './schemas/networkSchemas'

export const switchNetworkTool = createTool({
  id: 'switchNetwork',
  description:
    'Switch the connected wallet to a different blockchain network. Supported networks: ethereum, optimism, arbitrum, polygon, avalanche, bsc, base, gnosis',
  inputSchema: switchNetworkInput,
  outputSchema: switchNetworkOutput,
  execute: async ({ context }) => {
    const { network } = context

    const chainIdStr = networkToChainIdMap[network]
    const targetChainId = parseInt(chainIdStr.replace('eip155:', ''), 10)

    const result: SwitchNetworkOutput = {
      chainId: targetChainId,
      networkName: network,
      action: 'switch_network',
    }

    return Promise.resolve(result)
  },
})

export type { SwitchNetworkInput, SwitchNetworkOutput }
