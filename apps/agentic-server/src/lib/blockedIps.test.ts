import { expect, test } from 'bun:test'
import { Hono } from 'hono'

import { blockedIps } from './blockedIps'
import type { ServerEnv } from './requestBudget'

function fixture(list: string | undefined) {
  const app = new Hono<ServerEnv>()
  app.use('*', blockedIps(list))
  app.post('/api/chat', c => c.text('ok'))
  return app
}

test('rejects listed client addresses', async () => {
  const app = fixture(' 198.51.100.9 , 203.0.113.1')
  const response = await app.request('/api/chat', { method: 'POST' }, { clientIp: '198.51.100.9' })
  expect(response.status).toBe(403)
})
test('admits other client addresses', async () => {
  const app = fixture('198.51.100.9')
  const response = await app.request('/api/chat', { method: 'POST' }, { clientIp: '203.0.113.2' })
  expect(response.status).toBe(200)
})
test('admits everyone when no list is configured', async () => {
  const response = await fixture(undefined).request('/api/chat', { method: 'POST' }, { clientIp: '198.51.100.9' })
  expect(response.status).toBe(200)
})
