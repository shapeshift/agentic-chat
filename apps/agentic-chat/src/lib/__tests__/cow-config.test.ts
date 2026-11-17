import { describe, expect, it } from 'bun:test'

import { getCowApiUrl } from '../cow-config'

describe('getCowApiUrl', () => {
  it('uses the CoW API network names', () => {
    expect(getCowApiUrl(1)).toBe('https://api.cow.fi/mainnet')
    expect(getCowApiUrl(100)).toBe('https://api.cow.fi/xdai')
    expect(getCowApiUrl(42161)).toBe('https://api.cow.fi/arbitrum_one')
  })
})
