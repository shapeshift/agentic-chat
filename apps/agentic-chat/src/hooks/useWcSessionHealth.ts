import { modal } from '@reown/appkit/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'

import { useConnectionType } from './useConnectionType'

interface WcHealthResult {
  healthy: boolean
  error?: string
}

export interface WcSessionHealthResult {
  isHealthy: boolean | null // null = unknown/not applicable
  checkHealth: () => Promise<boolean>
  error: string | null
}

const HEALTH_CHECK_INTERVAL_MS = 30_000 // 30 seconds
const HEALTH_CHECK_TIMEOUT_MS = 5_000 // 5 seconds
const HEALTH_CACHE_TIME_MS = 5_000 // 5 seconds

// Patterns that indicate a stale/dead WalletConnect session
const STALE_SESSION_PATTERNS = [
  'method not found',
  'not exist',
  'not available',
  'session disconnected',
  'no matching key',
  'expired',
  'timeout',
]

function isStaleSessionErrorMessage(message: string): boolean {
  const lowerMessage = message.toLowerCase()
  return STALE_SESSION_PATTERNS.some(pattern => lowerMessage.includes(pattern))
}

async function pingWcSession(): Promise<WcHealthResult> {
  try {
    const provider = await modal?.getUniversalProvider()

    if (!provider?.session) {
      // No WC session = not applicable, consider healthy
      return { healthy: true }
    }

    // Use eth_chainId as a lightweight ping - this is the exact call that fails
    // when sessions are stale
    const chainIdPromise = provider.request({ method: 'eth_chainId' })

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Health check timeout')), HEALTH_CHECK_TIMEOUT_MS)
    })

    await Promise.race([chainIdPromise, timeoutPromise])

    return { healthy: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (isStaleSessionErrorMessage(message)) {
      return { healthy: false, error: message }
    }

    // Other errors might be transient network issues, don't mark as unhealthy
    console.warn('[WC Health] Transient error during health check:', message)
    return { healthy: true }
  }
}

export function useWcSessionHealth(): WcSessionHealthResult {
  const queryClient = useQueryClient()
  const { isWalletConnect } = useConnectionType()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { data } = useQuery({
    queryKey: ['wcSessionHealth'],
    queryFn: pingWcSession,
    enabled: isWalletConnect,
    staleTime: HEALTH_CACHE_TIME_MS,
    gcTime: HEALTH_CACHE_TIME_MS * 2,
    refetchOnWindowFocus: true,
    refetchInterval: false, // We manage polling manually
  })

  // Manual polling with interval
  useEffect(() => {
    if (!isWalletConnect) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ['wcSessionHealth'] })
    }, HEALTH_CHECK_INTERVAL_MS)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isWalletConnect, queryClient])

  // On-demand health check (returns fresh result)
  const checkHealth = useCallback(async (): Promise<boolean> => {
    if (!isWalletConnect) {
      return true // Not applicable for non-WC connections
    }

    const result = await pingWcSession()

    // Update the cache with fresh result
    queryClient.setQueryData(['wcSessionHealth'], result)

    return result.healthy
  }, [isWalletConnect, queryClient])

  // If not WalletConnect, always return healthy (not applicable)
  if (!isWalletConnect) {
    return {
      isHealthy: true,
      checkHealth,
      error: null,
    }
  }

  return {
    isHealthy: data?.healthy ?? null,
    checkHealth,
    error: data?.error ?? null,
  }
}
