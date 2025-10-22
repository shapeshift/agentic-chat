import { NETWORKS } from '@shapeshiftoss/types'
import { z } from 'zod'

export const switchNetworkSchema = z.object({
  network: z.enum(NETWORKS).describe('Network name to switch to'),
})

export type SwitchNetworkInput = z.infer<typeof switchNetworkSchema>

export type SwitchNetworkOutput = {
  network: string
  action: 'switch_network'
}

export function executeSwitchNetwork(input: SwitchNetworkInput): SwitchNetworkOutput {
  console.log('[switchNetwork]:', input)

  return {
    network: input.network,
    action: 'switch_network',
  }
}

export const switchNetworkTool = {
  description: 'Switch the connected wallet to a different blockchain network',
  inputSchema: switchNetworkSchema,
  execute: executeSwitchNetwork,
}
