import { describe, expect, it } from 'bun:test'

import { formatShortTimestamp, formatTimestamp } from '../time'

describe('formatTimestamp', () => {
  it('formats a unix timestamp to full date', () => {
    // 2024-01-15 in unix seconds
    const result = formatTimestamp(1705276800)
    expect(result).toContain('January')
    expect(result).toContain('15')
    expect(result).toContain('2024')
  })
})

describe('formatShortTimestamp', () => {
  const nowSeconds = () => Math.floor(Date.now() / 1000)

  it('returns "Just now" for timestamps less than 1 minute ago', () => {
    const result = formatShortTimestamp(nowSeconds())
    expect(result).toBe('Just now')
  })

  it('returns minutes ago for timestamps less than 1 hour ago', () => {
    const fiveMinutesAgo = nowSeconds() - 5 * 60
    const result = formatShortTimestamp(fiveMinutesAgo)
    expect(result).toMatch(/\d+m ago/)
  })

  it('returns hours ago for timestamps less than 24 hours ago', () => {
    const threeHoursAgo = nowSeconds() - 3 * 60 * 60
    const result = formatShortTimestamp(threeHoursAgo)
    expect(result).toMatch(/\d+h ago/)
  })

  it('returns days ago for timestamps less than 30 days ago', () => {
    const fiveDaysAgo = nowSeconds() - 5 * 24 * 60 * 60
    const result = formatShortTimestamp(fiveDaysAgo)
    expect(result).toMatch(/\d+d ago/)
  })

  it('returns formatted date for timestamps more than 30 days ago', () => {
    const sixtyDaysAgo = nowSeconds() - 60 * 24 * 60 * 60
    const result = formatShortTimestamp(sixtyDaysAgo)
    // Should be a short date like "Dec 17"
    expect(result).toMatch(/[A-Z][a-z]{2} \d+/)
  })
})
