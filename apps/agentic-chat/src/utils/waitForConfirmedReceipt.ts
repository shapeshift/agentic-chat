import { getPublicClient } from '@wagmi/core'

import { wagmiConfig } from '@/lib/wagmi-config'

export async function waitForConfirmedReceipt(chainId: number, hash: `0x${string}`, confirmations = 1): Promise<void> {
  const publicClient = getPublicClient(wagmiConfig, { chainId })
  if (!publicClient) throw new Error(`No public client for chain ${chainId}`)
  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations })
  if (receipt.status === 'reverted') throw new Error(`Transaction reverted: ${hash}`)
}
