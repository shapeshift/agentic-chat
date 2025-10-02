import { NETWORKS } from '@shapeshiftoss/types'
import z from 'zod'

export const switchNetworkInput = z.object({
  network: z
    .enum(NETWORKS)
    .describe(
      'Network name to switch to. Must be one of: ethereum, optimism, arbitrum, polygon, avalanche, bsc, base, gnosis'
    ),
})

export const switchNetworkOutput = z.object({
  chainId: z.number().describe('The chain ID to switch to'),
  networkName: z.string().describe('The human-readable network name'),
  action: z.literal('switch_network').describe('Action identifier for frontend execution'),
})

export type SwitchNetworkInput = z.infer<typeof switchNetworkInput>
export type SwitchNetworkOutput = z.infer<typeof switchNetworkOutput>
