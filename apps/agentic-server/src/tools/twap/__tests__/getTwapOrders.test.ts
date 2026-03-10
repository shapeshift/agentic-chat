import { describe, expect, it } from 'bun:test'

import { deriveTwapStatus, getTwapFilledPartCount } from '../getTwapOrders'

import {
  BUY_TOKEN,
  createCowPartOrder,
  createTwapOrder,
  FUTURE_VALID_TO,
  NOW_SECONDS,
  PAST_VALID_TO,
  SELL_TOKEN,
} from './fixtures'

describe('deriveTwapStatus', () => {
  it('returns cancelled when order is not active', () => {
    const order = createTwapOrder()
    expect(deriveTwapStatus(order, [], false, NOW_SECONDS, false)).toBe('cancelled')
  })

  it('returns open when validTo is in the future', () => {
    const order = createTwapOrder({ validTo: FUTURE_VALID_TO })
    expect(deriveTwapStatus(order, [], true, NOW_SECONDS, false)).toBe('open')
  })

  it('returns open when validTo is 0', () => {
    const order = createTwapOrder({ validTo: 0 })
    expect(deriveTwapStatus(order, [], true, NOW_SECONDS, false)).toBe('open')
  })

  it('returns expired when CoW API failed (bug 1 regression)', () => {
    const order = createTwapOrder({ validTo: PAST_VALID_TO, numParts: 3 })
    expect(deriveTwapStatus(order, [], true, NOW_SECONDS, true)).toBe('expired')
  })

  it('returns expired when numParts is undefined (bug 2 regression)', () => {
    const order = createTwapOrder({ validTo: PAST_VALID_TO, numParts: undefined })
    expect(deriveTwapStatus(order, [], true, NOW_SECONDS, false)).toBe('expired')
  })

  it('returns expired when numParts is 0', () => {
    const order = createTwapOrder({ validTo: PAST_VALID_TO, numParts: 0 })
    expect(deriveTwapStatus(order, [], true, NOW_SECONDS, false)).toBe('expired')
  })

  it('returns fulfilled when all parts are filled', () => {
    const order = createTwapOrder({ validTo: PAST_VALID_TO, numParts: 2, sellAmountBaseUnit: '2000000000000000000' })
    const cowOrders = [createCowPartOrder({ uid: '1' }), createCowPartOrder({ uid: '2' })]
    expect(deriveTwapStatus(order, cowOrders, true, NOW_SECONDS, false)).toBe('fulfilled')
  })

  it('returns failed when zero parts are filled', () => {
    const order = createTwapOrder({ validTo: PAST_VALID_TO, numParts: 3 })
    expect(deriveTwapStatus(order, [], true, NOW_SECONDS, false)).toBe('failed')
  })

  it('returns partiallyFilled when some parts are filled', () => {
    const order = createTwapOrder({ validTo: PAST_VALID_TO, numParts: 3 })
    const cowOrders = [createCowPartOrder()]
    expect(deriveTwapStatus(order, cowOrders, true, NOW_SECONDS, false)).toBe('partiallyFilled')
  })
})

describe('getTwapFilledPartCount', () => {
  it('returns 0 when numParts is undefined', () => {
    const order = createTwapOrder({ numParts: undefined })
    expect(getTwapFilledPartCount(order, [createCowPartOrder()])).toBe(0)
  })

  it('returns 0 when numParts is 0', () => {
    const order = createTwapOrder({ numParts: 0 })
    expect(getTwapFilledPartCount(order, [createCowPartOrder()])).toBe(0)
  })

  it('returns 0 when numParts is negative', () => {
    const order = createTwapOrder({ numParts: -1 })
    expect(getTwapFilledPartCount(order, [createCowPartOrder()])).toBe(0)
  })

  it('returns 0 when totalSell is 0', () => {
    const order = createTwapOrder({ sellAmountBaseUnit: '0' })
    expect(getTwapFilledPartCount(order, [createCowPartOrder()])).toBe(0)
  })

  it('counts matching filled parts correctly', () => {
    const order = createTwapOrder({ numParts: 3 })
    const cowOrders = [createCowPartOrder({ uid: '1' }), createCowPartOrder({ uid: '2' })]
    expect(getTwapFilledPartCount(order, cowOrders)).toBe(2)
  })

  it('rejects orders with wrong signingScheme', () => {
    const order = createTwapOrder({ numParts: 3 })
    const cowOrders = [createCowPartOrder({ signingScheme: 'ethsign' })]
    expect(getTwapFilledPartCount(order, cowOrders)).toBe(0)
  })

  it('rejects orders with wrong sell token', () => {
    const order = createTwapOrder({ numParts: 3 })
    const cowOrders = [createCowPartOrder({ sellToken: '0xwrong' })]
    expect(getTwapFilledPartCount(order, cowOrders)).toBe(0)
  })

  it('rejects orders with wrong buy token', () => {
    const order = createTwapOrder({ numParts: 3 })
    const cowOrders = [createCowPartOrder({ buyToken: '0xwrong' })]
    expect(getTwapFilledPartCount(order, cowOrders)).toBe(0)
  })

  it('rejects orders with zero executedSellAmount', () => {
    const order = createTwapOrder({ numParts: 3 })
    const cowOrders = [createCowPartOrder({ executedSellAmount: '0' })]
    expect(getTwapFilledPartCount(order, cowOrders)).toBe(0)
  })

  it('rejects orders outside time window', () => {
    const order = createTwapOrder({ numParts: 3 })
    const beforeStart = new Date((NOW_SECONDS - 100000) * 1000).toISOString()
    const cowOrders = [createCowPartOrder({ creationDate: beforeStart })]
    expect(getTwapFilledPartCount(order, cowOrders)).toBe(0)
  })

  it('matches tokens case-insensitively', () => {
    const order = createTwapOrder({ numParts: 3 })
    const cowOrders = [
      createCowPartOrder({
        sellToken: SELL_TOKEN.toUpperCase(),
        buyToken: BUY_TOKEN.toUpperCase(),
      }),
    ]
    expect(getTwapFilledPartCount(order, cowOrders)).toBe(1)
  })
})
