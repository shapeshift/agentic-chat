import { chatRoute } from '@mastra/ai-sdk'
import { Mastra } from '@mastra/core'
import { LibSQLStore } from '@mastra/libsql'
import { PinoLogger } from '@mastra/loggers'

import { shapeshiftAgent } from './agents'
import { swapWorkflow } from './workflows'

export * from './agents'
export * from './tools'
export * from './workflows'

// Environment detection
const isDevelopment = process.env.NODE_ENV === 'development'
const isProduction = process.env.NODE_ENV === 'production'

// CORS configuration based on environment
const getCorsOrigins = () => {
  if (isProduction) {
    return [
      'https://shapeshift-agentic.vercel.app',
      'https://shapeshift-agentic-shapeshift.vercel.app', // Vercel team subdomain
    ]
  }
  if (isDevelopment) {
    return [
      'https://dev.shapeshift-agentic.vercel.app',
      'https://shapeshift-agentic-dev-shapeshift.vercel.app', // Vercel team subdomain
    ]
  }
  // Local development
  return ['http://localhost:4200', 'http://localhost:4300']
}

// Storage configuration
const getStorageConfig = () => {
  // In cloud environments, Mastra Cloud will provide the database URL
  const dbUrl = process.env.DATABASE_URL || process.env.MASTRA_DB_URL

  if (dbUrl) {
    return new LibSQLStore({ url: dbUrl })
  }

  // Local development fallback
  return new LibSQLStore({
    url: 'file:./mastra.db',
  })
}

export const mastra = new Mastra({
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 4111,
    cors: {
      origin: getCorsOrigins(),
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'x-mastra-key'],
      credentials: false,
    },
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
    shapeshiftAgent,
  },
  workflows: { swapWorkflow },
  storage: getStorageConfig(),
  logger: new PinoLogger({
    name: `Mastra-${isProduction ? 'Prod' : isDevelopment ? 'Dev' : 'Local'}`,
    level: isProduction ? 'warn' : 'info',
  }),
})
