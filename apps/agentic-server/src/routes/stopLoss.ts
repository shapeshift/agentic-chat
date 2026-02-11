import { Hono } from 'hono'

import { isCowSupportedChain } from '../lib/cow/types'
import {
  deleteStopLossOrder,
  getStopLossOrderById,
  getStopLossOrdersByOwner,
  insertStopLossOrder,
} from '../lib/stopLoss/db'
import type { StopLossOrder, StopLossStatus } from '../lib/stopLoss/db'

interface RegisterBody {
  id: string
  ownerAddress: string
  chainId: number
  sellToken: string
  buyToken: string
  sellAmount: string
  buyAmount: string
  validTo: number
  triggerPrice: string
  currentPriceAtCreation: string
  sellTokenCoingeckoId: string
  sellTokenSymbol: string
  buyTokenSymbol: string
  sellAmountHuman: string
  network: string
  signature: string
  orderPayload: string
  appData: string
  receiver: string
  expiresAt: string
}

const stopLossRoutes = new Hono()

stopLossRoutes.post('/register', async c => {
  try {
    const body: RegisterBody = await c.req.json()

    // Validate required fields
    if (!body.id || !body.ownerAddress || !body.signature || !body.orderPayload) {
      return c.json({ error: 'Missing required fields: id, ownerAddress, signature, orderPayload' }, 400)
    }

    // Validate signature is hex
    if (!body.signature.startsWith('0x')) {
      return c.json({ error: 'Signature must be a hex string starting with 0x' }, 400)
    }

    // Validate chain is CoW-supported
    if (!isCowSupportedChain(body.chainId)) {
      return c.json({ error: `Chain ${body.chainId} is not supported by CoW Protocol` }, 400)
    }

    // Validate not expired
    if (new Date(body.expiresAt) <= new Date()) {
      return c.json({ error: 'Order is already expired' }, 400)
    }

    // Validate trigger price is below current price
    if (Number(body.triggerPrice) >= Number(body.currentPriceAtCreation)) {
      return c.json({ error: 'Trigger price must be below current price for stop-loss orders' }, 400)
    }

    // Check for duplicate
    const existing = getStopLossOrderById(body.id)
    if (existing) {
      return c.json({ error: 'Order with this ID already exists' }, 409)
    }

    const now = new Date().toISOString()
    const order: StopLossOrder = {
      id: body.id,
      ownerAddress: body.ownerAddress.toLowerCase(),
      chainId: body.chainId,
      sellToken: body.sellToken,
      buyToken: body.buyToken,
      sellAmount: body.sellAmount,
      buyAmount: body.buyAmount,
      validTo: body.validTo,
      triggerPrice: body.triggerPrice,
      currentPriceAtCreation: body.currentPriceAtCreation,
      sellTokenCoingeckoId: body.sellTokenCoingeckoId,
      sellTokenSymbol: body.sellTokenSymbol,
      buyTokenSymbol: body.buyTokenSymbol,
      sellAmountHuman: body.sellAmountHuman,
      network: body.network,
      signature: body.signature,
      orderPayload: body.orderPayload,
      status: 'pending',
      cowOrderId: null,
      createdAt: now,
      updatedAt: now,
      triggeredAt: null,
      errorMessage: null,
      appData: body.appData,
      receiver: body.receiver,
      expiresAt: body.expiresAt,
    }

    insertStopLossOrder(order)

    console.log(
      `[StopLoss] Registered order ${order.id}: ${order.sellAmountHuman} ${order.sellTokenSymbol} → ${order.buyTokenSymbol} @ trigger $${order.triggerPrice}`
    )

    return c.json({ success: true, orderId: order.id })
  } catch (error) {
    console.error('[StopLoss] Register error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return c.json({ error: message }, 500)
  }
})

stopLossRoutes.get('/orders/:ownerAddress', c => {
  try {
    const rawOwnerAddress = c.req.param('ownerAddress')
    const ownerAddress = rawOwnerAddress.toLowerCase()
    const statusParam = c.req.query('status') as StopLossStatus | undefined
    const chainIdParam = c.req.query('chainId')
    const chainId = chainIdParam ? Number(chainIdParam) : undefined

    const orders = getStopLossOrdersByOwner(ownerAddress, { status: statusParam, chainId })
    return c.json({ orders, totalCount: orders.length })
  } catch (error) {
    console.error('[StopLoss] Get orders error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return c.json({ error: message }, 500)
  }
})

stopLossRoutes.delete('/orders/:orderId', async c => {
  try {
    const orderId = c.req.param('orderId')
    const body: { ownerAddress: string } = await c.req.json()

    if (!body.ownerAddress) {
      return c.json({ error: 'Missing ownerAddress in request body' }, 400)
    }

    const order = getStopLossOrderById(orderId)
    if (!order) {
      return c.json({ error: 'Order not found' }, 404)
    }

    // Verify ownership
    if (order.ownerAddress !== body.ownerAddress.toLowerCase()) {
      return c.json({ error: 'Not authorized to cancel this order' }, 403)
    }

    if (order.status !== 'pending') {
      return c.json({ error: `Cannot cancel order with status: ${order.status}` }, 400)
    }

    const deleted = deleteStopLossOrder(orderId)
    if (!deleted) {
      return c.json({ error: 'Failed to cancel order' }, 500)
    }

    console.log(`[StopLoss] Cancelled order ${orderId}`)
    return c.json({ success: true })
  } catch (error) {
    console.error('[StopLoss] Cancel error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return c.json({ error: message }, 500)
  }
})

export { stopLossRoutes }
