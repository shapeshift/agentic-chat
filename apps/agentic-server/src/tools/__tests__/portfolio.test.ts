import { beforeAll, describe, expect, mock, test } from 'bun:test'
import { Hono } from 'hono'

void mock.module('../getAccount', () => ({
  executeGetAccount: ({ network }: { network: string }) => {
    if (network !== 'gnosis') throw new Error('Upstream 500')
    return Promise.resolve({
      balances: { 'eip155:100/slip44:700': '1000000000000000000' },
    })
  },
}))
void mock.module('../../lib/asset/prices', () => ({
  getAssetPrices: () =>
    Promise.resolve([
      {
        assetId: 'eip155:100/slip44:700',
        name: 'xDAI',
        symbol: 'XDAI',
        precision: 18,
        price: '0',
      },
    ]),
}))

beforeAll(async () => {
  const { initializeRelatedAssetIndex } = await import('@shapeshiftoss/utils')
  const originalFetch = globalThis.fetch
  globalThis.fetch = Object.assign(() => Promise.resolve(Response.json({})), { preconnect: originalFetch.preconnect })
  try {
    await initializeRelatedAssetIndex()
  } finally {
    globalThis.fetch = originalFetch
  }
})

const { getPortfolioData, executeGetPortfolio } = await import('../portfolio')
const { handlePortfolioRequest } = await import('../../routes/portfolio')
const walletContext = {
  connectedWallets: {
    'eip155:1': { address: '0x000000000000000000000000000000000000dEaD' },
    'eip155:100': { address: '0x000000000000000000000000000000000000dEaD' },
  },
}

describe('partial portfolios', () => {
  test('retains balances without prices when another network fails', async () => {
    const result = await getPortfolioData({ networks: ['ethereum', 'gnosis'] }, walletContext)
    expect(result.networks.map(n => n.network)).toEqual(['gnosis'])
    expect(result.networks[0]?.balances[0]?.cryptoAmount).toBe('1')
    expect(result.failedNetworks.map(n => n.network)).toEqual(['ethereum'])
  })
  test('chat tool marks missing networks explicitly', async () => {
    const result = await executeGetPortfolio({ networks: ['ethereum', 'gnosis'] }, walletContext)
    expect(result.incomplete).toBe(true)
    expect(result.failedNetworks[0]?.network).toBe('ethereum')
  })
  test('reports all failed networks instead of inventing empty successful balances', async () => {
    const result = await getPortfolioData({ networks: ['ethereum'] }, walletContext)
    expect(result.networks).toEqual([])
    expect(result.failedNetworks).toHaveLength(1)
  })
  test('endpoint returns partial results to opted-in clients, preserves legacy failure semantics', async () => {
    const app = new Hono().post('/api/portfolio', handlePortfolioRequest)
    const request = (includeFailures: boolean) =>
      app.request('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evmAddress: walletContext.connectedWallets['eip155:1'].address,
          networks: ['ethereum', 'gnosis'],
          includeFailures,
        }),
      })
    const partial = await request(true)
    expect(partial.status).toBe(200)
    expect(await partial.json()).toMatchObject({
      networks: [{ network: 'gnosis' }],
      failedNetworks: [{ network: 'ethereum' }],
    })
    expect((await request(false)).status).toBe(503)
  })
})
