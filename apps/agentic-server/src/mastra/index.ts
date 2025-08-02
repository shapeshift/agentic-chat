import { Mastra } from '@mastra/core'
import { LibSQLStore } from '@mastra/libsql'
import { PinoLogger } from '@mastra/loggers'

import { shapeshiftAgent } from './agents/shapeshift-agent'
import { swapWorkflow } from './workflows/swap'

export * from './agents'
export * from './workflows'

export const mastra = new Mastra({
  agents: { shapeshiftAgent },
  workflows: { swapWorkflow },
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    //url: 'file:../mastra.db', // path is relative to the .mastra/output directory
    url: ':memory:',
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
})
