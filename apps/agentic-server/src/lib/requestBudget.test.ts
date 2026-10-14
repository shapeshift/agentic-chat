import { describe, expect, test } from 'bun:test'
import { Hono } from 'hono'

import { requestBudget } from './requestBudget'
import type { BudgetStore, ServerEnv } from './requestBudget'

function fixture(store: BudgetStore) {
  const app = new Hono<ServerEnv>()
  let calls = 0
  app.use('/api/*', requestBudget(store))
  app.post('/api/chat', c => {
    calls++
    return c.text('model output')
  })
  return { app, calls: () => calls }
}

describe('paid request admission', () => {
  test('rejects exhausted budget before any provider work', async () => {
    const { app, calls } = fixture({ acquire: async () => false, release: async () => {} })
    const response = await app.request('/api/chat', { method: 'POST' })
    expect(response.status).toBe(429)
    expect(calls()).toBe(0)
  })
  test('fails closed if shared quota storage is unavailable', async () => {
    const { app, calls } = fixture({
      acquire: async () => {
        throw new Error('offline')
      },
      release: async () => {},
    })
    expect((await app.request('/api/chat', { method: 'POST' })).status).toBe(503)
    expect(calls()).toBe(0)
  })
  test('rejects oversized bodies before budget or provider work', async () => {
    let admissions = 0
    const { app, calls } = fixture({
      acquire: async () => {
        admissions++
        return true
      },
      release: async () => {},
    })
    const response = await app.request('/api/chat', { method: 'POST', body: 'a'.repeat(65537) })
    expect(response.status).toBe(413)
    expect(admissions).toBe(0)
    expect(calls()).toBe(0)
  })
  test('uses socket identity and releases the lease after response consumption', async () => {
    let principal = ''
    let released = 0
    const { app } = fixture({
      acquire: async ip => {
        principal = ip
        return true
      },
      release: async () => {
        released++
      },
    })
    const response = await app.request(
      '/api/chat',
      { method: 'POST', headers: { 'x-forwarded-for': 'forged' } },
      { clientIp: '127.0.0.1' }
    )
    expect(principal).toBe('127.0.0.1')
    expect(await response.text()).toBe('model output')
    expect(released).toBe(1)
  })
})

test('disconnect aborts provider work and releases a streaming lease', async () => {
  let released = 0
  let signal: AbortSignal | undefined
  const app = new Hono<ServerEnv>()
  app.use(
    '*',
    requestBudget({
      acquire: async () => true,
      release: async () => {
        released++
      },
    })
  )
  app.post('/api/chat', c => {
    signal = c.get('requestSignal')
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1]))
        },
      })
    )
  })
  const response = await app.request('/api/chat', { method: 'POST' })
  await response.body?.cancel()
  expect(signal?.aborted).toBe(true)
  expect(released).toBe(1)
})

test('deadline reaches pending provider work before headers are available', async () => {
  const app = new Hono<ServerEnv>()
  app.use('*', requestBudget({ acquire: async () => true, release: async () => {} }, 10))
  app.post('/api/chat', async c => {
    await new Promise<void>(resolve =>
      c.get('requestSignal').addEventListener('abort', () => resolve(), { once: true })
    )
    return c.text('timed out', 504)
  })
  const response = await app.request('/api/chat', { method: 'POST' })
  expect(response.status).toBe(504)
  await response.text()
})
