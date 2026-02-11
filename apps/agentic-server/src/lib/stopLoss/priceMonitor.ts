import { getBulkPrices } from '../asset/coingecko/api'
import { submitCowOrder } from '../cow'
import type { CowOrderQuote } from '../cow/types'
import { getCowExplorerUrl } from '../cow/types'

import { expireStaleOrders, getPendingStopLossOrders, updateStopLossStatus } from './db'
import type { StopLossOrder } from './db'

const POLL_INTERVAL_MS = 15_000

let intervalId: ReturnType<typeof setInterval> | null = null

async function processOrder(order: StopLossOrder, currentPrice: number): Promise<void> {
  const triggerPrice = Number(order.triggerPrice)

  if (currentPrice > triggerPrice) return

  console.log(
    `[PriceMonitor] Triggered: ${order.sellTokenSymbol} price $${currentPrice} <= trigger $${triggerPrice} (order ${order.id})`
  )

  const now = new Date().toISOString()
  updateStopLossStatus(order.id, 'triggered', { triggeredAt: now })

  try {
    const orderPayload = JSON.parse(order.orderPayload) as CowOrderQuote
    const cowOrderId = await submitCowOrder(order.chainId, orderPayload, order.signature)

    updateStopLossStatus(order.id, 'submitted', { cowOrderId })
    console.log(`[PriceMonitor] Submitted to CoW: ${cowOrderId} — ${getCowExplorerUrl(cowOrderId)}`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    updateStopLossStatus(order.id, 'failed', { errorMessage })
    console.error(`[PriceMonitor] Failed to submit order ${order.id}:`, errorMessage)
  }
}

async function tick(): Promise<void> {
  try {
    const expiredCount = expireStaleOrders()
    if (expiredCount > 0) {
      console.log(`[PriceMonitor] Expired ${expiredCount} stale orders`)
    }

    const pendingOrders = getPendingStopLossOrders()
    if (pendingOrders.length === 0) return

    // Batch price lookups by coingecko ID
    const uniqueCoingeckoIds = [...new Set(pendingOrders.map(o => o.sellTokenCoingeckoId))]
    const priceData = await getBulkPrices(uniqueCoingeckoIds)

    // Process each order independently
    const results = await Promise.allSettled(
      pendingOrders.map(order => {
        const priceInfo = priceData[order.sellTokenCoingeckoId]
        const currentPrice = priceInfo?.usd

        if (currentPrice === undefined) {
          console.warn(`[PriceMonitor] No price for ${order.sellTokenCoingeckoId} (order ${order.id})`)
          return Promise.resolve()
        }

        return processOrder(order, currentPrice)
      })
    )

    const failures = results.filter(r => r.status === 'rejected')
    if (failures.length > 0) {
      console.error(`[PriceMonitor] ${failures.length} order(s) failed processing`)
    }
  } catch (error) {
    console.error('[PriceMonitor] Tick error:', error)
  }
}

export function startPriceMonitor(): void {
  if (intervalId) {
    console.warn('[PriceMonitor] Already running')
    return
  }

  console.log(`[PriceMonitor] Starting (polling every ${POLL_INTERVAL_MS / 1000}s)`)
  intervalId = setInterval(() => void tick(), POLL_INTERVAL_MS)

  // Run immediately on start
  void tick()
}

export function stopPriceMonitor(): void {
  if (!intervalId) return

  clearInterval(intervalId)
  intervalId = null
  console.log('[PriceMonitor] Stopped')
}
