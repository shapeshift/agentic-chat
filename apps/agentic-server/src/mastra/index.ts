import { chatRoute } from '@mastra/ai-sdk'
import { Mastra } from '@mastra/core'
import { LibSQLStore } from '@mastra/libsql'
import { PinoLogger } from '@mastra/loggers'

import { shapeshiftAgent } from './agents'

export * from './agents'
export * from './tools'

// CORS configuration - simple localhost vs production detection
const getCorsOrigins = () => {
  // In production/cloud environments
  if (process.env.NODE_ENV === 'production') {
    return [
      'https://shapeshift-agentic.vercel.app',
      'https://shapeshift-agentic-shapeshift.vercel.app',
      'https://dev.shapeshift-agentic.vercel.app', // Allow dev branch too
      'https://shapeshift-agentic-dev-shapeshift.vercel.app',
    ]
  }

  // Local development (any localhost port)
  return ['http://localhost:4200', 'http://localhost:4201', 'http://localhost:4300']
}

// Storage configuration
const getStorageConfig = () => {
  const dbUrl = process.env.DATABASE_URL

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
    host: '0.0.0.0',
    port: Number.isFinite(Number(process.env.PORT)) ? Number(process.env.PORT) : 4111,
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
          try {
            const contentType = c.req.header('content-type')
            if (!contentType?.includes('application/json')) {
              return next()
            }

            const body = await c.req.json()

            if ('state' in body && body.state == null) {
              delete body.state
              delete body.tools
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            c.req.json = async () => Promise.resolve(body)
          } catch (error) {
            console.error('Error parsing request body:', error)
          }

          return next()
        },
      },
    ],
    apiRoutes: [
      chatRoute({
        path: '/chat/:agentId',
      }),
      {
        method: 'GET',
        path: '/ping',
        handler: c => {
          return c.json({ status: 'ok', timestamp: new Date().toISOString() })
        },
      },
      {
        method: 'GET',
        path: '/health',
        handler: c => {
          return c.json({ status: 'healthy', timestamp: new Date().toISOString() })
        },
      },
    ],
  },
  agents: {
    shapeshiftAgent,
  },
  storage: getStorageConfig(),
  logger: new PinoLogger({
    name: `Mastra-${process.env.NODE_ENV === 'production' ? 'Prod' : 'Local'}`,
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
  }),
})
