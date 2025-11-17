import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { handleChatRequest } from './routes/chat'

const app = new Hono()

// Enable CORS for all routes
app.use(
  '/*',
  cors({
    origin: [
      'http://localhost:4200',
      'http://localhost:5173',
      'https://shapeshift-agentic.vercel.app',
      'https://agent.shapeshift.com',
    ],
    credentials: true,
  })
)

// Health check endpoint
app.get('/health', c => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Chat endpoint
app.post('/api/chat', handleChatRequest)

// 404 handler
app.notFound(c => {
  return c.json({ error: 'Not found' }, 404)
})

// Error handler
app.onError((err, c) => {
  console.error('[Server Error]:', err)
  return c.json({ error: 'Internal server error', message: err.message }, 500)
})

const port = Number(process.env.PORT) || 4111

console.log(`🚀 Server starting on port ${port}`)
console.log(`   API: /api/chat`)
console.log(`   Health: /health`)

export default {
  fetch: app.fetch,
  port,
  // Increase timeout to handle exhaustive transaction history queries
  // which can take longer when fetching across multiple networks
  idleTimeout: 30, // 30 seconds
}
