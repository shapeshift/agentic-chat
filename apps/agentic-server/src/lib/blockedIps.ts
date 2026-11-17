import type { MiddlewareHandler } from 'hono'

import type { ServerEnv } from './requestBudget'

/** Rejects requests from a comma-separated list of client addresses before any other work. */
export function blockedIps(list: string | undefined): MiddlewareHandler<ServerEnv> {
  const blocked = new Set(
    (list ?? '')
      .split(',')
      .map(ip => ip.trim())
      .filter(Boolean)
  )
  return async (c, next) => {
    const ip = c.env?.clientIp
    if (ip && blocked.has(ip)) return c.json({ error: 'Forbidden' }, 403)
    await next()
  }
}
