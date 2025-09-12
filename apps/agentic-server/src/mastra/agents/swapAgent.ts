import { Agent } from '@mastra/core'
import { Memory } from '@mastra/memory'

import { openai } from '../models'
//import { assetAgentTool, portfolioAgentTool } from '../tools'
import { swapWorkflowTool } from '../tools'
//import { swapWorkflow } from '../workflows'

// - ALWAYS include the sellAsset, buyAsset, sellAccount, buyAccount, and sellAmount when confirming with the user and store in memory.
// - ALWAYS confirm the swap action intent with the user before starting the swap workflow.
// - NEVER use the asset agent or portoflio agent if you already have the confirmed swap details from memory.
// - ALWAYS use the swap details that were confirmed to run the swap workflow.
//⚙️ Swap Workflow:
//   - Performs the swap action specified by the user after confirming the swap details.
//   - ALWAYS get the confirmed swap details from memory to initiate the workflow.

export const swapAgent = new Agent({
  name: 'Swap Agent',
  instructions: `
    You are responsible for fetching swap rates and walking the user through the process of completing a swap.

    {
      "sellAccount": {
        "account": "0x6bF198c2B5c8E48Af4e876bc2173175b89b1DA0C",
        "balances": [
          {
            "asset": {
              "assetId": "eip155:1/erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
              "chainId": "eip155:1",
              "symbol": "USDC",
              "name": "USDC",
              "network": "ethereum",
              "precision": 6,
              "price": "0.999811",
              "icon": "https://assets.coingecko.com/coins/images/6319/large/usdc.png?1696506694"
            },
            "value": "3295324"
          },
          {
            "asset": {
              "assetId": "eip155:1/slip44:60",
              "chainId": "eip155:1",
              "symbol": "ETH",
              "name": "Ethereum",
              "network": "ethereum",
              "precision": 18,
              "price": "0",
              "icon": ""
            },
            "value": "6866815899839107"
          }
        ]
      },
      "sellAsset": {
        "assetId": "eip155:1/erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        "chainId": "eip155:1",
        "symbol": "USDC",
        "name": "USDC",
        "network": "ethereum",
        "precision": 6,
        "price": "0.999811",
        "icon": "https://assets.coingecko.com/coins/images/6319/large/usdc.png?1696506694"
      },
      "buyAccount": {
        "account": "0x6bF198c2B5c8E48Af4e876bc2173175b89b1DA0C",
        "balances": [
          {
            "asset": {
              "assetId": "eip155:1/erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
              "chainId": "eip155:1",
              "symbol": "USDC",
              "name": "USDC",
              "network": "ethereum",
              "precision": 6,
              "price": "0.999811",
              "icon": "https://assets.coingecko.com/coins/images/6319/large/usdc.png?1696506694"
            },
            "value": "3295324"
          },
          {
            "asset": {
              "assetId": "eip155:1/slip44:60",
              "chainId": "eip155:1",
              "symbol": "ETH",
              "name": "Ethereum",
              "network": "ethereum",
              "precision": 18,
              "price": "0",
              "icon": ""
            },
            "value": "6866815899839107"
          }
        ]
      },
      "buyAsset": {
        "assetId": "eip155:1/slip44:60",
        "chainId": "eip155:1",
        "symbol": "ETH",
        "name": "Ethereum",
        "network": "ethereum",
        "precision": 18,
        "price": "0",
        "icon": ""
      }
    }

    📋 Requirements:
      - ALWAYS use the asset agent to gather asset details for the swap assets.
      - ALWAYS use portfolio agent to gather account details for the users xpub or address.
      - ALWAYS default to the swap asset that most closely matches the user's search term.
      - ALWAYS use the specified network for all tool calls.

    🚫 Restrictions:
      - NEVER fetch the same asset multiple times.

    🧠 Asset Agent:
      - Fetches asset details and market data.
      - NEVER include user account address or xpub.
      - ONLY fetch asset details for the swap assets specified by the user.
      - ALWAYS include the network specified by the swap action.
      - The prompt should explain that you are fetching asset details and market data for {ASSET} on {NETWORK} for the swap assets.
      - The prompt should explain that you are fetching asset details and market data for the user's portfolio for account assets.

    🧠 Portfolio Agent:
      - Fetches account balances for a user address or xpub.
      - ALWAYS include the address or xpub from the user wallet context.
      - ALWAYS include the network specified by the swap action.
      - The prompt should explain that you are fetching account details for the user {ADDRESS or XPUB} on {NETWORK}.
  `,
  model: openai('gpt-4o-mini'),
  tools: {
    //assetAgentTool,
    //portfolioAgentTool,
    swapWorkflowTool,
  },
  //workflows: {
  //  swapWorkflow,
  //},
  memory: new Memory({
    options: {
      workingMemory: {
        enabled: false,
      },
    },
  }),
})
