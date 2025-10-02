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
      {
        method: 'GET',
        path: '/api/threads',
        handler: async c => {
          const resourceId = c.req.query('resourceId')
          if (!resourceId) {
            return c.json({ error: 'resourceId is required' }, 400)
          }

          const storage = mastra.storage
          if (!storage) {
            return c.json({ error: 'Storage not configured' }, 500)
          }

          const threads = await storage.getThreadsByResourceId({
            resourceId,
            orderBy: 'updatedAt',
            sortDirection: 'DESC',
          })

          return c.json({
            threads: threads.map(thread => ({
              remoteId: thread.id,
              externalId: undefined,
              title: thread.title ?? 'New Chat',
              status: 'regular' as const,
            })),
          })
        },
      },
      {
        method: 'POST',
        path: '/api/threads',
        handler: async c => {
          const body = await c.req.json()
          const { resourceId, title, metadata } = body as {
            resourceId: string
            title?: string
            metadata?: Record<string, unknown>
          }

          if (!resourceId) {
            return c.json({ error: 'resourceId is required' }, 400)
          }

          const storage = mastra.storage
          if (!storage) {
            return c.json({ error: 'Storage not configured' }, 500)
          }

          const thread = await storage.saveThread({
            thread: {
              id: crypto.randomUUID(),
              resourceId,
              title: title ?? 'New Chat',
              metadata: metadata ?? {},
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          })

          return c.json({
            remoteId: thread.id,
            externalId: undefined,
          })
        },
      },
      {
        method: 'PUT',
        path: '/api/threads/:threadId',
        handler: async c => {
          const threadId = c.req.param('threadId')
          const body = await c.req.json()
          const { title, metadata } = body as {
            title?: string
            metadata?: Record<string, unknown>
          }

          if (!threadId) {
            return c.json({ error: 'threadId is required' }, 400)
          }

          const storage = mastra.storage
          if (!storage) {
            return c.json({ error: 'Storage not configured' }, 500)
          }

          await storage.updateThread({
            id: threadId,
            title: title ?? 'New Chat',
            metadata: metadata ?? {},
          })

          return c.json({ success: true })
        },
      },
      {
        method: 'DELETE',
        path: '/api/threads/:threadId',
        handler: async c => {
          const threadId = c.req.param('threadId')

          if (!threadId) {
            return c.json({ error: 'threadId is required' }, 400)
          }

          const storage = mastra.storage
          if (!storage) {
            return c.json({ error: 'Storage not configured' }, 500)
          }

          await storage.deleteThread({ threadId })

          return c.json({ success: true })
        },
      },
      {
        method: 'POST',
        path: '/api/threads/:threadId/generate-title',
        handler: async c => {
          const threadId = c.req.param('threadId')
          const body = await c.req.json()
          const { messages } = body as { messages: Array<{ role: string; content: string }> }

          if (!threadId || !messages || messages.length === 0) {
            return c.json({ error: 'threadId and messages are required' }, 400)
          }

          const storage = mastra.storage
          if (!storage) {
            return c.json({ error: 'Storage not configured' }, 500)
          }

          const firstUserMessage = messages.find(m => m.role === 'user')?.content ?? 'New Chat'
          const title = firstUserMessage.slice(0, 50) + (firstUserMessage.length > 50 ? '...' : '')

          await storage.updateThread({
            id: threadId,
            title,
            metadata: {},
          })

          return c.json({ title })
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
