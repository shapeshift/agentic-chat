import { NETWORKS } from '@shapeshiftoss/types'
import z from 'zod'

export const switchNetworkInput = z.object({
  network: z.enum(NETWORKS).describe('Network name to switch to'),
})

export const switchNetworkOutput = z.object({
  network: z.string().describe('The network name to switch to'),
  action: z.literal('switch_network').describe('Action identifier for frontend execution'),
})

export type SwitchNetworkInput = z.infer<typeof switchNetworkInput>
export type SwitchNetworkOutput = z.infer<typeof switchNetworkOutput>
