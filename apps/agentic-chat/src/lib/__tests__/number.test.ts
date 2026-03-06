import { describe, expect, it } from 'bun:test'

import { getFiatNumberFractionDigits, formatFiat, formatCompactNumber, formatPercent } from '../number'

describe('getFiatNumberFractionDigits', () => {
  it('returns 0 for numbers >= 1', () => {
    expect(getFiatNumberFractionDigits(1)).toBe(0)
    expect(getFiatNumberFractionDigits(100)).toBe(0)
    expect(getFiatNumberFractionDigits(1000000)).toBe(0)
  })

  it('returns 3 for numbers in [0.1, 1)', () => {
    expect(getFiatNumberFractionDigits(0.5)).toBe(3)
    expect(getFiatNumberFractionDigits(0.1)).toBe(3)
  })

  it('returns 4 for numbers in [0.01, 0.1)', () => {
    expect(getFiatNumberFractionDigits(0.05)).toBe(4)
    expect(getFiatNumberFractionDigits(0.01)).toBe(4)
  })

  it('returns 5 for numbers in [0.001, 0.01)', () => {
    expect(getFiatNumberFractionDigits(0.005)).toBe(5)
    expect(getFiatNumberFractionDigits(0.001)).toBe(5)
  })

  it('returns 6 for numbers in [0.0001, 0.001)', () => {
    expect(getFiatNumberFractionDigits(0.0005)).toBe(6)
    expect(getFiatNumberFractionDigits(0.0001)).toBe(6)
  })

  it('returns 7 for numbers in [0.00001, 0.0001)', () => {
    expect(getFiatNumberFractionDigits(0.00005)).toBe(7)
    expect(getFiatNumberFractionDigits(0.00001)).toBe(7)
  })

  it('returns 8 for numbers in [0.000001, 0.00001)', () => {
    expect(getFiatNumberFractionDigits(0.000005)).toBe(8)
    expect(getFiatNumberFractionDigits(0.000001)).toBe(8)
  })

  it('returns 0 for numbers < 0.000001', () => {
    expect(getFiatNumberFractionDigits(0.0000001)).toBe(0)
  })
})

describe('formatFiat', () => {
  it('returns N/A for null', () => {
    expect(formatFiat(null)).toBe('N/A')
  })

  it('returns N/A for undefined', () => {
    expect(formatFiat(undefined)).toBe('N/A')
  })

  it('formats NaN as zero (bnOrZero coerces NaN to 0)', () => {
    const result = formatFiat(NaN)
    expect(result).toContain('$')
    expect(result).toContain('0')
  })

  it('formats Infinity as zero (bnOrZero coerces Infinity to 0)', () => {
    const result = formatFiat(Infinity)
    expect(result).toContain('$')
    expect(result).toContain('0')
  })

  it('formats valid numbers as USD', () => {
    const result = formatFiat(1234.56)
    expect(result).toContain('$')
    expect(result).toContain('1,234')
  })

  it('formats zero', () => {
    const result = formatFiat(0)
    expect(result).toContain('$')
    expect(result).toContain('0')
  })

  it('formats string values', () => {
    const result = formatFiat('500')
    expect(result).toContain('$')
    expect(result).toContain('500')
  })
})

describe('formatCompactNumber', () => {
  it('returns N/A for null', () => {
    expect(formatCompactNumber(null)).toBe('N/A')
  })

  it('returns N/A for undefined', () => {
    expect(formatCompactNumber(undefined)).toBe('N/A')
  })

  it('formats valid numbers without currency', () => {
    const result = formatCompactNumber(1234)
    expect(result).not.toContain('$')
    expect(result).toContain('1,234')
  })

  it('formats Infinity as zero (bnOrZero coerces Infinity to 0)', () => {
    const result = formatCompactNumber(Infinity)
    expect(result).toContain('0')
  })
})

describe('formatPercent', () => {
  it('returns N/A for null', () => {
    expect(formatPercent(null)).toBe('N/A')
  })

  it('returns N/A for undefined', () => {
    expect(formatPercent(undefined)).toBe('N/A')
  })

  it('formats valid percentage (value is in 0-100 range)', () => {
    const result = formatPercent(50)
    expect(result).toContain('50')
    expect(result).toContain('%')
  })

  it('formats small percentage', () => {
    const result = formatPercent(1.23)
    expect(result).toContain('1.23')
    expect(result).toContain('%')
  })

  it('formats Infinity as zero percent (bnOrZero coerces Infinity to 0)', () => {
    expect(formatPercent(Infinity)).toBe('0.00%')
  })
})
