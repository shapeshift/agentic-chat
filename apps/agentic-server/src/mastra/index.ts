import { Mastra } from '@mastra/core'
import { RuntimeContext } from '@mastra/core/runtime-context'
import { registerApiRoute } from '@mastra/core/server'
import { LibSQLStore } from '@mastra/libsql'
import { PinoLogger } from '@mastra/loggers'
import type { Context } from 'hono'

import { shapeshiftAgent } from './agents'

interface WalletContext {
  evmAddress?: string
  solanaAddress?: string
}

type MastraHonoContext = Context & {
  Variables: {
    walletContext?: WalletContext
    mastra: Mastra
  }
}

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

            // Extract wallet context from context array
            if (body.context && Array.isArray(body.context) && body.context[0]?.content) {
              try {
                const walletContext = JSON.parse(body.context[0].content)
                if (walletContext && typeof walletContext === 'object') {
                  c.set('walletContext', walletContext)
                }
              } catch (parseError) {
                console.error('[Middleware] Failed to parse wallet context from context:', parseError)
              }
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            c.req.json = async () => Promise.resolve(body)
          } catch (error) {
            console.error('[Middleware] Error parsing request body:', error)
          }

          return next()
        },
      },
    ],
    apiRoutes: [
      registerApiRoute('/chat/:agentId', {
        method: 'POST',
        handler: async c => {
          const { messages, ...rest } = await c.req.json()
          const mastra = c.get('mastra')
          const agentId = c.req.param('agentId')

          if (!agentId) {
            throw new Error('Agent ID is required')
          }

          const agentObj = mastra.getAgent(agentId)
          if (!agentObj) {
            throw new Error(`Agent ${agentId} not found`)
          }

          // Extract wallet context from Hono context (set by middleware)
          const walletContext = (c as MastraHonoContext).get('walletContext')

          // Create runtime context with wallet context
          const runtimeContext = new RuntimeContext()
          if (walletContext) {
            runtimeContext.set('walletContext', walletContext)
          }

          const result = await agentObj.streamVNext(messages, {
            ...rest,
            format: 'aisdk',
            runtimeContext,
          })

          return (result as any).toUIMessageStreamResponse()
        },
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
