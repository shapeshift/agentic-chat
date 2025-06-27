import type { WalletClient } from 'viem'
import z from 'zod'

export const switchEvmChainParams = z.object({
  chainId: z.number().describe('The chain ID to switch to'),
})

export type SwitchEvmChainParams = z.infer<typeof switchEvmChainParams>
export type SwitchEvmChainResult = number

export const switchEvmChain = async ({
  walletClient,
  chainId,
}: {
  walletClient: WalletClient | undefined
  chainId: number
}): Promise<SwitchEvmChainResult> => {
  if (!walletClient) {
    throw new Error('No account connected')
  }

  await walletClient.switchChain({
    id: chainId,
  })

  return chainId
}
