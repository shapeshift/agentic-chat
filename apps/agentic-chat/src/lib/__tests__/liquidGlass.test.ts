import { describe, expect, it } from 'bun:test'

import { shouldEnableLiquidGlass } from '../liquidGlass'

const createMediaMatcher = (matchingQueries: string[]) => {
  return (query: string) =>
    ({
      matches: matchingQueries.includes(query),
      media: query,
    }) as MediaQueryList
}

const createNavigator = (hardwareConcurrency = 8, deviceMemory?: number) => {
  return {
    hardwareConcurrency,
    ...(deviceMemory === undefined ? {} : { deviceMemory }),
  } as Navigator
}

describe('shouldEnableLiquidGlass', () => {
  it('enables liquid glass on non-mobile capable devices', () => {
    const enabled = shouldEnableLiquidGlass(createNavigator(), createMediaMatcher([]))
    expect(enabled).toBe(true)
  })

  it('disables for reduced motion preference', () => {
    const enabled = shouldEnableLiquidGlass(createNavigator(), createMediaMatcher(['(prefers-reduced-motion: reduce)']))
    expect(enabled).toBe(false)
  })

  it('disables on coarse pointer devices', () => {
    const enabled = shouldEnableLiquidGlass(createNavigator(), createMediaMatcher(['(pointer: coarse)']))
    expect(enabled).toBe(false)
  })

  it('disables on narrow viewports', () => {
    const enabled = shouldEnableLiquidGlass(createNavigator(), createMediaMatcher(['(max-width: 768px)']))
    expect(enabled).toBe(false)
  })

  it('disables when hardware resources are limited', () => {
    const lowCpuEnabled = shouldEnableLiquidGlass(createNavigator(4), createMediaMatcher([]))
    const lowMemoryEnabled = shouldEnableLiquidGlass(createNavigator(8, 4), createMediaMatcher([]))

    expect(lowCpuEnabled).toBe(false)
    expect(lowMemoryEnabled).toBe(false)
  })
})
