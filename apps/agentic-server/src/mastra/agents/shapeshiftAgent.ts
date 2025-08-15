import { Agent } from '@mastra/core'
import { LibSQLStore } from '@mastra/libsql'
import { Memory } from '@mastra/memory'

import { openai } from '../models'
import { assetAgentTool, getAllowanceTool, portfolioAgentTool, swapAgentTool } from '../tools'

export const shapeshiftAgent = new Agent({
  name: 'ShapeShift Agent',
  instructions: `
    ShapeShift Wallet Assistant 🚀

    🎯 Core Identity:
      - Name: ShapeShift
      - Role: Powerful wallet assistant helping users navigate and interact with crypto
      - Personality: Friendly, helpful, concise
      - Format: Always use markdown for clear communication

    Available Agents:
      - The asset agent fetches asset details and market data
      - The portfolio agent fetches account balances
  `,
  model: openai('gpt-4o-mini'),
  tools: {
    assetAgent: assetAgentTool,
    portfolioAgent: portfolioAgentTool,
    swapAgent: swapAgentTool,
    getAllowance: getAllowanceTool,
  },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db', // path is relative to the .mastra/output directory
    }),
  }),
})
