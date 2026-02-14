import BigNumber from 'bignumber.js'
import { describe, expect, it } from 'bun:test'

import { bn, bnOrZero } from '../bignumber'

describe('bn', () => {
  it('creates a BigNumber from a number', () => {
    expect(bn(42).toNumber()).toBe(42)
  })

  it('creates a BigNumber from a string', () => {
    expect(bn('123.456').toFixed(3)).toBe('123.456')
  })
})

describe('bnOrZero', () => {
  it('returns BigNumber(0) for null', () => {
    expect(bnOrZero(null).isEqualTo(new BigNumber(0))).toBe(true)
  })

  it('returns BigNumber(0) for undefined', () => {
    expect(bnOrZero(undefined).isEqualTo(new BigNumber(0))).toBe(true)
  })

  it('returns BigNumber(0) for empty string', () => {
    expect(bnOrZero('').isEqualTo(new BigNumber(0))).toBe(true)
  })

  it('returns BigNumber(0) for NaN', () => {
    expect(bnOrZero(NaN).isEqualTo(new BigNumber(0))).toBe(true)
  })

  it('returns BigNumber(0) for Infinity', () => {
    expect(bnOrZero(Infinity).isEqualTo(new BigNumber(0))).toBe(true)
  })

  it('returns BigNumber(0) for negative Infinity', () => {
    expect(bnOrZero(-Infinity).isEqualTo(new BigNumber(0))).toBe(true)
  })

  it('returns correct BigNumber for valid number', () => {
    expect(bnOrZero(42).toNumber()).toBe(42)
  })

  it('returns correct BigNumber for valid string', () => {
    expect(bnOrZero('123.456').toFixed(3)).toBe('123.456')
  })

  it('returns BigNumber(0) for non-numeric string', () => {
    expect(bnOrZero('not-a-number').isEqualTo(new BigNumber(0))).toBe(true)
  })
})
