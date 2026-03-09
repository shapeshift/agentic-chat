import util from 'util'

import { AssetService } from '@shapeshiftoss/utils'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { initializeAllAssetData, refreshAllAssetData } from './lib/assetInit'
import { handleChatRequest } from './routes/chat'
import { handlePortfolioRequest } from './routes/portfolio'

// Prevent console.log truncation of deep objects and large arrays
util.inspect.defaultOptions.depth = null
util.inspect.defaultOptions.maxArrayLength = null
util.inspect.defaultOptions.maxStringLength = null

console.log('Initializing asset data...')
try {
  await initializeAllAssetData()
  AssetService.setOnStale(refreshAllAssetData)
  console.log('Asset data initialized')
} catch (error) {
  console.error('Failed to initialize asset data:', error)
  process.exit(1)
}

const app = new Hono()

// Enable CORS for all routes
app.use(
  '/*',
  cors({
    origin: [
      // Local development
      'http://localhost:3000',
      'http://localhost:4200',
      'http://localhost:5173',
      // ShapeShift Web deployments
      'https://app.shapeshift.com',
      'https://develop.shapeshift.com',
      'https://private.shapeshift.com',
      // Agentic Chat deployments
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

// Portfolio endpoint
app.post('/api/portfolio', handlePortfolioRequest)

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

console.log(`Server starting on port ${port}`)
console.log(`   API: /api/chat`)
console.log(`   API: /api/portfolio`)
console.log(`   Health: /health`)

export default {
  fetch: app.fetch,
  port,
  // Increase timeout to handle exhaustive transaction history queries
  // which can take longer when fetching across multiple networks
  idleTimeout: 30, // 30 seconds
}
