import { Agent } from '@mastra/core'
import { Memory } from '@mastra/memory'

import { openai } from '../models'
import { getPortfolioTool } from '../tools'
import { NETWORK_TO_CHAIN_ID } from '../tools/asset/constants'

import { supportedChainsContext } from './context'

export const portfolioAgent = new Agent({
  name: 'Portfolio Agent',
  instructions:
    `
    You fetch portfolio balances with asset details.

    Parse the formatted prompt to extract:
    - User address (0x...)
    - Token filter (specific token or "all")
    - Network: specific network name OR "all networks"

    If network is "all networks": call getPortfolio tool for each supported network
    If specific network: call getPortfolio tool once

    Use getPortfolio tool with: address, chainId (from network), network
    The tool provides precalculated cryptoValue and userCurrencyValue.

    Filter results to match requested token(s) and return all balances found.

  ` + supportedChainsContext + `

    Network to ChainId mapping: ${JSON.stringify(NETWORK_TO_CHAIN_ID, null, 2)}
  `,
  model: openai('gpt-4o-mini'),
  tools: {
    getPortfolioTool,
  },
  memory: new Memory({
    options: {
      workingMemory: {
        enabled: false,
      },
    },
  }),
})
