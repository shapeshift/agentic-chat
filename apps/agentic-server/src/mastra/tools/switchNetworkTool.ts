import { createTool } from '@mastra/core'

import { switchNetworkInput, switchNetworkOutput } from './schemas/networkSchemas'
import type { SwitchNetworkInput, SwitchNetworkOutput } from './schemas/networkSchemas'

export const switchNetworkTool = createTool({
  id: 'switchNetwork',
  description: 'Switch the connected wallet to a different blockchain network',
  inputSchema: switchNetworkInput,
  outputSchema: switchNetworkOutput,
  execute: async ({ context }) => {
    const { network } = context

    const result: SwitchNetworkOutput = {
      network,
      action: 'switch_network',
    }

    return Promise.resolve(result)
  },
})

export type { SwitchNetworkInput, SwitchNetworkOutput }
