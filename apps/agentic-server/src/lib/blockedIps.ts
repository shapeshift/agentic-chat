import { isIP } from 'node:net'

import type { MiddlewareHandler } from 'hono'

import type { ServerEnv } from './requestBudget'

// Equivalent IPv6 spellings (2001:0db8::0001 vs 2001:db8::1) must compare equal.
function canonicalIp(ip: string): string {
  if (isIP(ip) !== 6) return ip
  try {
    return new URL(`http://[${ip}]`).hostname.slice(1, -1)
  } catch {
    // Zone IDs (fe80::1%eth0) aren't valid URL hosts; fall back to exact matching.
    return ip.toLowerCase()
  }
}

/** Rejects requests from a comma-separated list of client addresses before any other work. */
export function blockedIps(list: string | undefined): MiddlewareHandler<ServerEnv> {
  const blocked = new Set(
    (list ?? '')
      .split(',')
      .map(ip => ip.trim())
      .filter(Boolean)
      .map(canonicalIp)
  )
  return async (c, next) => {
    const ip = c.env?.clientIp
    if (ip && blocked.has(canonicalIp(ip))) return c.json({ error: 'Forbidden' }, 403)
    await next()
  }
}
