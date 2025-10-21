import { Mastra } from '@mastra/core'
import type { MessageListInput } from '@mastra/core/agent/message-list'
import { RuntimeContext } from '@mastra/core/runtime-context'
import { registerApiRoute } from '@mastra/core/server'
import { LibSQLStore } from '@mastra/libsql'
import { PinoLogger } from '@mastra/loggers'
import type { Context } from 'hono'

import { shapeshiftAgent } from './agents'
import { MASTRA_DB_PATH } from './config'

type MastraHonoContext = Context & {
  Variables: {
    walletContext?: unknown
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
  return new LibSQLStore({
    url: MASTRA_DB_PATH,
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
                const content = body.context[0].content as string
                const walletContext = JSON.parse(content) as unknown
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
          const { messages, threadId, resourceId, ...rest } = await c.req.json()
          const mastra = c.get('mastra')
          const agentId = c.req.param('agentId')

          console.log('[Chat Endpoint] Request received:', {
            agentId,
            threadId,
            resourceId,
            messageCount: messages?.length || 0,
          })

          if (!agentId) {
            throw new Error('Agent ID is required')
          }

          const agentObj = mastra.getAgent(agentId)
          if (!agentObj) {
            throw new Error(`Agent ${agentId} not found`)
          }

          // Log agent memory configuration
          const agentMemory = await agentObj.getMemory({ runtimeContext: new RuntimeContext() })
          console.log('[Chat Endpoint] Agent memory config:', {
            hasMemory: !!agentMemory,
          })

          // Extract wallet context from Hono context (set by middleware)
          const walletContext = (c as MastraHonoContext).get('walletContext')

          // Create runtime context with wallet context
          const runtimeContext = new RuntimeContext()
          if (walletContext) {
            runtimeContext.set('walletContext', walletContext)
          }

          console.log('[Chat Endpoint] Calling streamVNext with memory config:', {
            thread: threadId,
            resource: resourceId,
          })

          const result = await agentObj.streamVNext(
            messages as MessageListInput,
            {
              ...rest,
              memory: {
                thread: threadId,
                resource: resourceId,
              },
              format: 'aisdk',
              runtimeContext,
            } as Parameters<typeof agentObj.streamVNext>[1]
          )

          console.log('[Chat Endpoint] Stream created successfully')

          // Check thread title multiple times to catch title generation
          const checkTitle = async (attempt: number) => {
            try {
              const storage = mastra.storage
              if (storage) {
                const thread = await storage.getThreadById({ threadId })
                console.log(`[Chat Endpoint] Thread check ${attempt}:`, {
                  threadId,
                  title: thread?.title,
                  startsWithNewThread: thread?.title?.startsWith('New Thread'),
                })
              }
            } catch (error) {
              console.error(`[Chat Endpoint] Error checking thread (attempt ${attempt}):`, error)
            }
          }

          setTimeout(() => void checkTitle(1), 2000)
          setTimeout(() => void checkTitle(2), 5000)
          setTimeout(() => void checkTitle(3), 10000)

          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
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
      {
        method: 'GET',
        path: '/api/threads',
        handler: async c => {
          const resourceId = c.req.query('resourceId')
          if (!resourceId) {
            return c.json({ error: 'resourceId query parameter is required' }, 400)
          }

          const mastra = c.get('mastra')
          const storage = mastra.storage

          if (!storage) {
            return c.json({ error: 'Storage not configured' }, 500)
          }

          try {
            const threads = await storage.getThreadsByResourceId({ resourceId })
            console.log('[GET /api/threads] Fetched threads:', {
              resourceId,
              count: threads.length,
              titles: threads.map((t: { id: string; title: string }) => ({ id: t.id, title: t.title })),
            })
            return c.json({ threads })
          } catch (error) {
            console.error('[GET /api/threads] Error fetching threads:', error)
            return c.json({ error: 'Failed to fetch threads' }, 500)
          }
        },
      },
      {
        method: 'POST',
        path: '/api/generate-title',
        handler: async c => {
          const body = await c.req.json()
          const { message } = body

          if (!message) {
            return c.json({ error: 'message is required' }, 400)
          }

          try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                  {
                    role: 'user',
                    content: `Generate a concise 3-5 word title for this user message. Return ONLY the title text, nothing else.\n\nMessage: ${message}`,
                  },
                ],
                temperature: 0.7,
                max_tokens: 20,
              }),
            })

            const data = (await response.json()) as { choices: Array<{ message: { content: string } }> }
            const title = data.choices[0]?.message?.content?.trim() || 'New Chat'
            console.log('[POST /api/generate-title] Generated title:', { message, title })

            return c.json({ title })
          } catch (error) {
            console.error('[POST /api/generate-title] Error generating title:', error)
            return c.json({ error: 'Failed to generate title' }, 500)
          }
        },
      },
      {
        method: 'PATCH',
        path: '/api/threads/:threadId',
        handler: async c => {
          const threadId = c.req.param('threadId')
          const body = await c.req.json()
          const { title, metadata } = body

          if (!threadId) {
            return c.json({ error: 'threadId is required' }, 400)
          }

          const mastra = c.get('mastra')
          const storage = mastra.storage

          if (!storage) {
            return c.json({ error: 'Storage not configured' }, 500)
          }

          try {
            const existingThread = await storage.getThreadById({ threadId })
            if (!existingThread) {
              return c.json({ error: 'Thread not found' }, 404)
            }

            const updatedThread = {
              ...existingThread,
              ...(title !== undefined && { title }),
              ...(metadata !== undefined && { metadata: JSON.stringify(metadata) }),
              updatedAt: new Date().toISOString(),
            }

            await storage.saveThread(updatedThread)
            return c.json({ thread: updatedThread })
          } catch (error) {
            console.error('[PATCH /api/threads/:threadId] Error updating thread:', error)
            return c.json({ error: 'Failed to update thread' }, 500)
          }
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
