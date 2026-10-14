import { isIP } from 'node:net'

export function clientIp(
  socketAddress: string | undefined,
  forwardedFor: string | undefined,
  trustedProxies: string[]
): string {
  if (!socketAddress || !isIP(socketAddress)) return 'unknown'
  if (!trustedProxies.includes(socketAddress) || !forwardedFor) return socketAddress
  const hops = forwardedFor.split(',').map(value => value.trim())
  if (hops.length > 10 || hops.some(hop => !isIP(hop))) return socketAddress
  return [...hops, socketAddress].reverse().find(hop => !trustedProxies.includes(hop)) ?? socketAddress
}
