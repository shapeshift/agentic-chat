import { createHash, randomUUID } from 'node:crypto'

import { RedisClient } from 'bun'
import type { MiddlewareHandler } from 'hono'

import { withRequestSignal } from './requestContext'

export type ServerEnv = {
  Bindings: { clientIp?: string }
  Variables: { requestSignal: AbortSignal }
}

export interface BudgetStore {
  acquire(ip: string, id: string): Promise<boolean>
  release(id: string): Promise<void>
}

export const admissionScript = `
local now = tonumber(redis.call('TIME')[1])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now)
if redis.call('ZCARD', KEYS[1]) >= 8 then return 0 end
local limits = {10, 60, 1000}
local ttl = {60, 3600, 86400}
for i = 1, 3 do
  if tonumber(redis.call('GET', KEYS[i+1]) or '0') >= limits[i] then return 0 end
end
for i = 1, 3 do
  if redis.call('INCR', KEYS[i+1]) == 1 then redis.call('EXPIRE', KEYS[i+1], ttl[i]) end
end
redis.call('ZADD', KEYS[1], now + 120, ARGV[1])
redis.call('EXPIRE', KEYS[1], 120)
return 1
`

export function redisBudgetStore(): BudgetStore {
  const url = process.env.REDIS_URL
  const redis = url ? new RedisClient(url, { connectionTimeout: 2000, maxRetries: 0 }) : undefined
  const activeKey = '{agentic-budget}:active'
  return {
    async acquire(ip, id) {
      if (!redis) throw new Error('REDIS_URL is required for paid API requests')
      const principal = createHash('sha256').update(ip).digest('hex')
      const result: unknown = await redis.send('EVAL', [
        admissionScript,
        '4',
        activeKey,
        `{agentic-budget}:minute:${principal}`,
        `{agentic-budget}:hour:${principal}`,
        '{agentic-budget}:day',
        id,
      ])
      return result === 1
    },
    async release(id) {
      await redis?.send('ZREM', [activeKey, id])
    },
  }
}

export function requestBudget(store: BudgetStore, requestTimeoutMs = 60_000): MiddlewareHandler<ServerEnv> {
  return async (c, next) => {
    const reader = c.req.raw.body?.getReader()
    if (reader) {
      const chunks: Uint8Array[] = []
      let bytes = 0
      let bodyTimedOut = false
      const bodyTimer = setTimeout(() => {
        bodyTimedOut = true
        void reader.cancel().catch(() => undefined)
      }, 10_000)
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          bytes += value.byteLength
          if (bytes > 64 * 1024) {
            await reader.cancel()
            return c.json({ error: 'Request body too large' }, 413)
          }
          chunks.push(value)
        }
      } catch {
        return c.json({ error: 'Invalid request body' }, 400)
      } finally {
        clearTimeout(bodyTimer)
      }
      if (bodyTimedOut) return c.json({ error: 'Request body timed out' }, 408)
      const body = new Uint8Array(bytes)
      let offset = 0
      for (const chunk of chunks) {
        body.set(chunk, offset)
        offset += chunk.byteLength
      }
      c.req.raw = new Request(c.req.raw, { body })
    }
    const id = randomUUID()
    // Only the socket address supplied by the Bun server is trusted, never a client header.
    const ip = c.env?.clientIp ?? 'unknown'
    try {
      if (!(await store.acquire(ip, id))) {
        c.header('Retry-After', '60')
        return c.json({ error: 'Request budget exceeded' }, 429)
      }
    } catch {
      return c.json({ error: 'Request budget unavailable' }, 503)
    }
    const controller = new AbortController()
    const signal = AbortSignal.any([controller.signal, c.req.raw.signal])
    c.set('requestSignal', signal)
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs)
    let released = false
    const release = async () => {
      if (released) return
      released = true
      clearTimeout(timer)
      try {
        await store.release(id)
      } catch {
        /* The Redis lease also expires. */
      }
    }
    try {
      await withRequestSignal(signal, next)
      const response = c.res
      const reader = response.body?.getReader()
      if (!reader) {
        await release()
        return
      }
      const cancel = () => {
        void reader
          .cancel()
          .catch(() => undefined)
          .finally(release)
      }
      signal.addEventListener('abort', cancel, { once: true })
      if (signal.aborted) cancel()
      const finish = async () => {
        signal.removeEventListener('abort', cancel)
        await release()
      }
      const body = new ReadableStream<Uint8Array>({
        async pull(stream) {
          try {
            const chunk = await reader.read()
            if (chunk.done) {
              stream.close()
              await finish()
            } else stream.enqueue(chunk.value)
          } catch (error) {
            stream.error(error)
            await finish()
          }
        },
        async cancel(reason) {
          controller.abort()
          await reader.cancel(reason)
          await finish()
        },
      })
      c.res = new Response(body, { status: response.status, headers: response.headers })
    } catch (error) {
      controller.abort()
      await release()
      throw error
    }
  }
}
