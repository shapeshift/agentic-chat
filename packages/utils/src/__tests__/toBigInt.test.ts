import { describe, expect, test } from 'bun:test'
import BigNumber from 'bignumber.js'

import { toBigInt, toBaseUnit } from '../index'

describe('toBigInt', () => {
  test('converts plain integer string', () => {
    expect(toBigInt('100')).toBe(100n)
  })

  test('converts zero', () => {
    expect(toBigInt('0')).toBe(0n)
  })

  test('converts large integer string (PEPE-scale: 100k tokens with 18 decimals)', () => {
    expect(toBigInt('100000000000000000000000')).toBe(100000000000000000000000n)
  })

  test('converts scientific notation string', () => {
    expect(toBigInt('1e+23')).toBe(100000000000000000000000n)
  })

  test('converts scientific notation with lowercase e', () => {
    expect(toBigInt('1e23')).toBe(100000000000000000000000n)
  })

  test('truncates decimal values to integer', () => {
    expect(toBigInt('100.7')).toBe(101n)
  })

  test('converts number input', () => {
    expect(toBigInt(42)).toBe(42n)
  })

  test('converts BigNumber input', () => {
    expect(toBigInt(new BigNumber('100000000000000000000000'))).toBe(100000000000000000000000n)
  })

  test('converts BigNumber with scientific notation toString', () => {
    const bn = new BigNumber('100000000000000000000000')
    expect(bn.toString()).toBe('1e+23')
    expect(toBigInt(bn)).toBe(100000000000000000000000n)
  })

  test('converts negative value', () => {
    expect(toBigInt('-100')).toBe(-100n)
  })

  test('converts very small decimal to zero', () => {
    expect(toBigInt('0.0001')).toBe(0n)
  })

  test('handles toBaseUnit output for PEPE (18 decimals, 100k tokens)', () => {
    const baseUnit = toBaseUnit('100000', 18)
    expect(toBigInt(baseUnit)).toBe(100000000000000000000000n)
  })

  test('handles toBaseUnit output for USDC (6 decimals)', () => {
    const baseUnit = toBaseUnit('1000', 6)
    expect(toBigInt(baseUnit)).toBe(1000000000n)
  })

  test('handles toBaseUnit output for very small PEPE amount', () => {
    const baseUnit = toBaseUnit('0.335689', 6)
    expect(toBigInt(baseUnit)).toBe(335689n)
  })

  test('handles 1 million PEPE (1e24 base units)', () => {
    const baseUnit = toBaseUnit('1000000', 18)
    expect(toBigInt(baseUnit)).toBe(1000000000000000000000000n)
  })

  test('handles SHIB-scale amounts (trillions of tokens)', () => {
    const baseUnit = toBaseUnit('1000000000', 18)
    expect(toBigInt(baseUnit)).toBe(1000000000000000000000000000n)
  })
})

describe('toBaseUnit + toBigInt pipeline', () => {
  const testCases = [
    { amount: '100000', precision: 18, label: '100k PEPE' },
    { amount: '1000000', precision: 18, label: '1M PEPE' },
    { amount: '1000000000', precision: 18, label: '1B meme token' },
    { amount: '0.001', precision: 18, label: 'tiny ETH amount' },
    { amount: '100', precision: 6, label: '100 USDC' },
    { amount: '0.335689', precision: 6, label: 'fractional USDC' },
    { amount: '1', precision: 8, label: '1 WBTC' },
  ]

  for (const { amount, precision, label } of testCases) {
    test(`round-trips ${label} (${amount} with ${precision} decimals)`, () => {
      const baseUnit = toBaseUnit(amount, precision)
      const result = toBigInt(baseUnit)
      expect(typeof result).toBe('bigint')
      expect(result >= 0n).toBe(true)
    })
  }
})
