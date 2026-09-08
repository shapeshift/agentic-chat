import { afterAll, afterEach, describe, expect, spyOn, test } from 'bun:test'

import { fetchFullPortfolio } from '../portfolioService'

const fetchSpy = spyOn(globalThis, 'fetch')
afterEach(() => fetchSpy.mockReset())
afterAll(() => fetchSpy.mockRestore())
const network = {
  network: 'gnosis',
  chainId: 'eip155:100',
  account: '0x123',
  balances: [
    {
      asset: {
        assetId: 'eip155:100/slip44:700',
        name: 'xDAI',
        symbol: 'XDAI',
        precision: 18,
        price: '0',
      },
      baseUnitValue: '1000000000000000000',
      cryptoAmount: '1',
      usdAmount: '0',
    },
  ],
}

describe('portfolio fetch failures', () => {
  test('retains unpriced tokens and carries partial-network status', async () => {
    fetchSpy.mockResolvedValue(
      Response.json({
        networks: [network],
        failedNetworks: [{ network: 'ethereum' }],
      })
    )
    const result = await fetchFullPortfolio('0x123')
    expect(result.assets[0]?.cryptoBalancePrecision).toBe('1')
    expect(result.hasMissingPrices).toBe(true)
    expect(result.failedNetworks).toEqual(['ethereum'])
    expect(result.delta24h).toBeNull()
  })
  test('all-network failure is an error, not a zero portfolio', async () => {
    fetchSpy.mockResolvedValue(
      Response.json({
        networks: [],
        failedNetworks: [{ network: 'ethereum' }],
      })
    )
    expect(await fetchFullPortfolio('0x123').catch((error: Error) => error.message)).toContain(
      'Unable to load balances'
    )
  })
  test('HTTP errors propagate so cached balances can be retained', async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 500 }))
    expect(await fetchFullPortfolio('0x123').catch((error: Error) => error.message)).toContain(
      'Unable to load portfolio'
    )
  })
  test('supports legacy server arrays', async () => {
    fetchSpy.mockResolvedValue(Response.json([network]))
    const result = await fetchFullPortfolio('0x123')
    expect(result.assets).toHaveLength(1)
    expect(result.failedNetworks).toEqual([])
  })
})
