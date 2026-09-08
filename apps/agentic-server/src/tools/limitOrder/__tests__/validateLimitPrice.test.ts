import { describe, expect, test } from 'bun:test'

import { validateLimitPrice } from '../validateLimitPrice'

const arb = { symbol: 'ARB', price: '0.5' }
const usdc = { symbol: 'USDC', price: '1' }

describe('limit price sanity checks', () => {
  test('asks for clarification on the advertised sub-dollar inversion', () => {
    expect(() => validateLimitPrice('2', arb, usdc)).toThrow('inverted pair price')
    expect(() => validateLimitPrice('2', arb, usdc)).toThrow('confirm the exact target in USDC per 1 ARB')
    expect(() => validateLimitPrice('2', arb, usdc, true)).not.toThrow()
  })

  test('accepts the market rate and ordinary percentage targets', () => {
    for (const price of ['0.5', '0.525', '0.45']) expect(() => validateLimitPrice(price, arb, usdc)).not.toThrow()
    // ARB $0.12 / EUL $1.39, with a 5% increase in the pair rate.
    expect(() =>
      validateLimitPrice('0.09064748201438849', { symbol: 'ARB', price: '0.12' }, { symbol: 'EUL', price: '1.39' })
    ).not.toThrow()
  })

  test('flags USD prices used as crypto-to-crypto pair prices', () => {
    const sell = { symbol: 'ARB', price: '0.12' }
    const buy = { symbol: 'EUL', price: '1.39' }
    expect(() => validateLimitPrice('1.39', sell, buy)).toThrow('USD token price')
    expect(() => validateLimitPrice('1.39', sell, buy, true)).not.toThrow()
  })

  test('allows explicitly confirmed distant future targets', () => {
    expect(() => validateLimitPrice('600', arb, usdc)).toThrow('more than 10×')
    expect(() => validateLimitPrice('600', arb, usdc, true)).not.toThrow()
    expect(() => validateLimitPrice('0.0001', arb, usdc)).toThrow('more than 10×')
    expect(() => validateLimitPrice('0.0001', arb, usdc, true)).not.toThrow()
  })

  test('does not round tiny pair rates to zero in guidance', () => {
    const sell = { symbol: 'SMALL', price: '0.000001' }
    const buy = { symbol: 'WETH', price: '3000' }
    expect(() => validateLimitPrice('0.000001', sell, buy)).toThrow('3.3333333e-10')
    expect(() => validateLimitPrice('0.000000000333333333', sell, buy)).not.toThrow()
  })

  test('rejects invalid prices regardless of market data or confirmation', () => {
    for (const value of ['0', '-1', 'NaN', 'Infinity', '1 USDC', '']) {
      expect(() => validateLimitPrice(value, arb, usdc, true)).toThrow('positive number')
      expect(() => validateLimitPrice(value, { symbol: 'ARB', price: '0' }, usdc)).toThrow('positive number')
    }
  })

  test('does not infer an inversion from unavailable prices', () => {
    for (const price of ['0', 'NaN', 'Infinity', '-1']) {
      expect(() => validateLimitPrice('0.5', { symbol: 'ARB', price }, usdc)).not.toThrow()
      expect(() => validateLimitPrice('0.5', arb, { symbol: 'USDC', price })).not.toThrow()
    }
  })
})
