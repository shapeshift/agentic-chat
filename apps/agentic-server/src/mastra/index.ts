import { Mastra } from '@mastra/core'
import { LibSQLStore } from '@mastra/libsql'
import { PinoLogger } from '@mastra/loggers'

import { assetAgent, portfolioAgent, shapeshiftAgent } from './agents'
import { swapWorkflow } from './workflows/swap'

export * from './agents'
export * from './tools'
export * from './workflows'

export const mastra = new Mastra({
  agents: {
    asset: assetAgent,
    portfolio: portfolioAgent,
    shapeshift: shapeshiftAgent,
  },
  workflows: { swapWorkflow },
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ':memory:',
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
})
