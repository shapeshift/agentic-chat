import { z } from 'zod'

import { getSupportedOracleTokens } from '../lib/composableCow/oracles'
import { NETWORK_TO_CHAIN_ID } from '../lib/cow/types'

const networkEnum = ['ethereum', 'gnosis', 'arbitrum'] as const

export const getPriceFeedTokensSchema = z.object({
  network: z.enum(networkEnum).describe('Network to check for price feed support'),
})

export type GetPriceFeedTokensInput = z.infer<typeof getPriceFeedTokensSchema>

export type GetPriceFeedTokensOutput = {
  network: string
  tokenCount: number
  tokens: string[]
}

export function executeGetPriceFeedTokens(input: GetPriceFeedTokensInput): GetPriceFeedTokensOutput {
  const chainId = NETWORK_TO_CHAIN_ID[input.network] as number
  const tokens = [...getSupportedOracleTokens(chainId)].sort((a, b) => a.localeCompare(b))

  return {
    network: input.network,
    tokenCount: tokens.length,
    tokens,
  }
}

export const getPriceFeedTokensTool = {
  description: `Get the list of tokens that have Chainlink on-chain price feeds on a given network.
Only tokens returned by this tool can be used as sell or buy assets in stop-loss orders (createStopLoss). TWAP/DCA orders do NOT require price feeds.

Call this BEFORE createStopLoss when unsure if a token has oracle support, or when the user asks "which tokens can I set a stop-loss on?".

No UI card - format and present the data in your response.`,
  inputSchema: getPriceFeedTokensSchema,
  execute: executeGetPriceFeedTokens,
}
