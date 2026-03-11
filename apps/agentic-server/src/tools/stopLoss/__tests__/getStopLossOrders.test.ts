import { describe, expect, it } from 'bun:test'

import { deriveStopLossStatus, isStopLossFulfilled } from '../getStopLossOrders'

import {
  BUY_TOKEN,
  createCowOrder,
  createStopLossOrder,
  FUTURE_VALID_TO,
  NOW_SECONDS,
  PAST_VALID_TO,
  SELL_TOKEN,
} from './fixtures'

describe('isStopLossFulfilled', () => {
  it('returns true when a matching executed order exists', () => {
    const order = createStopLossOrder()
    const cowOrders = [createCowOrder()]
    expect(isStopLossFulfilled(order, cowOrders)).toBe(true)
  })

  it('returns false with no cow orders', () => {
    const order = createStopLossOrder()
    expect(isStopLossFulfilled(order, [])).toBe(false)
  })

  it('rejects orders with wrong signingScheme', () => {
    const order = createStopLossOrder()
    const cowOrders = [createCowOrder({ signingScheme: 'ethsign' })]
    expect(isStopLossFulfilled(order, cowOrders)).toBe(false)
  })

  it('rejects orders with wrong sell token', () => {
    const order = createStopLossOrder()
    const cowOrders = [createCowOrder({ sellToken: '0xwrong' })]
    expect(isStopLossFulfilled(order, cowOrders)).toBe(false)
  })

  it('rejects orders with wrong buy token', () => {
    const order = createStopLossOrder()
    const cowOrders = [createCowOrder({ buyToken: '0xwrong' })]
    expect(isStopLossFulfilled(order, cowOrders)).toBe(false)
  })

  it('rejects orders with zero executedSellAmount', () => {
    const order = createStopLossOrder()
    const cowOrders = [createCowOrder({ executedSellAmount: '0' })]
    expect(isStopLossFulfilled(order, cowOrders)).toBe(false)
  })

  it('rejects orders with undefined executedSellAmount', () => {
    const order = createStopLossOrder()
    const cowOrders = [createCowOrder({ executedSellAmount: undefined })]
    expect(isStopLossFulfilled(order, cowOrders)).toBe(false)
  })

  it('rejects orders created before the stop-loss', () => {
    const order = createStopLossOrder()
    const beforeStart = new Date((NOW_SECONDS - 100000) * 1000).toISOString()
    const cowOrders = [createCowOrder({ creationDate: beforeStart })]
    expect(isStopLossFulfilled(order, cowOrders)).toBe(false)
  })

  it('rejects orders created after validTo', () => {
    const order = createStopLossOrder()
    const afterExpiry = new Date((PAST_VALID_TO + 100) * 1000).toISOString()
    const cowOrders = [createCowOrder({ creationDate: afterExpiry })]
    expect(isStopLossFulfilled(order, cowOrders)).toBe(false)
  })

  it('matches tokens case-insensitively', () => {
    const order = createStopLossOrder()
    const cowOrders = [
      createCowOrder({
        sellToken: SELL_TOKEN.toUpperCase(),
        buyToken: BUY_TOKEN.toUpperCase(),
      }),
    ]
    expect(isStopLossFulfilled(order, cowOrders)).toBe(true)
  })
})

describe('deriveStopLossStatus', () => {
  it('returns cancelled when order is not active', () => {
    const order = createStopLossOrder()
    expect(deriveStopLossStatus(order, [], false, NOW_SECONDS, false)).toBe('cancelled')
  })

  it('returns open when validTo is in the future', () => {
    const order = createStopLossOrder({ validTo: FUTURE_VALID_TO })
    expect(deriveStopLossStatus(order, [], true, NOW_SECONDS, false)).toBe('open')
  })

  it('returns open when validTo is 0', () => {
    const order = createStopLossOrder({ validTo: 0 })
    expect(deriveStopLossStatus(order, [], true, NOW_SECONDS, false)).toBe('open')
  })

  it('returns fulfilled when cow order matched regardless of expiry', () => {
    const order = createStopLossOrder({ validTo: FUTURE_VALID_TO })
    const cowOrders = [createCowOrder()]
    expect(deriveStopLossStatus(order, cowOrders, true, NOW_SECONDS, false)).toBe('fulfilled')
  })

  it('returns fulfilled when expired and cow order matched', () => {
    const order = createStopLossOrder({ validTo: PAST_VALID_TO })
    const cowOrders = [createCowOrder()]
    expect(deriveStopLossStatus(order, cowOrders, true, NOW_SECONDS, false)).toBe('fulfilled')
  })

  it('returns expired when expired and no cow order matched', () => {
    const order = createStopLossOrder({ validTo: PAST_VALID_TO })
    expect(deriveStopLossStatus(order, [], true, NOW_SECONDS, false)).toBe('expired')
  })

  it('returns open when cowApiFailed and not expired', () => {
    const order = createStopLossOrder({ validTo: FUTURE_VALID_TO })
    expect(deriveStopLossStatus(order, [], true, NOW_SECONDS, true)).toBe('open')
  })

  it('returns expired when cowApiFailed and expired', () => {
    const order = createStopLossOrder({ validTo: PAST_VALID_TO })
    expect(deriveStopLossStatus(order, [], true, NOW_SECONDS, true)).toBe('expired')
  })

  it('returns cancelled over expired when not active', () => {
    const order = createStopLossOrder({ validTo: PAST_VALID_TO })
    expect(deriveStopLossStatus(order, [], false, NOW_SECONDS, false)).toBe('cancelled')
  })
})
