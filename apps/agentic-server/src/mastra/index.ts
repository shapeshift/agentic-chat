import { chatRoute } from '@mastra/ai-sdk'
import { Mastra } from '@mastra/core'
import { LibSQLStore } from '@mastra/libsql'
import { PinoLogger } from '@mastra/loggers'

import { assetAgent, portfolioAgent, shapeshiftAgent, swapAgent } from './agents'
import { swapWorkflow } from './workflows/swap/swapWorkflow'

export * from './agents'
export * from './tools'
export * from './workflows'

export const mastra = new Mastra({
  server: {
    middleware: [
      {
        path: '/chat/*',
        handler: async (c, next) => {
          const body = await c.req.json()

          if ('state' in body && body.state == null) {
            delete body.state
            delete body.tools
          }

          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          c.req.json = async () => Promise.resolve(body)

          return next()
        },
      },
    ],
    apiRoutes: [
      chatRoute({
        path: '/chat/:agentId',
      }),
    ],
  },
  agents: {
    assetAgent,
    portfolioAgent,
    shapeshiftAgent,
    swapAgent,
  },
  workflows: { swapWorkflow },
  storage: new LibSQLStore({
    url: 'file:./mastra.db',
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
})
