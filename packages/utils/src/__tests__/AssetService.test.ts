import { describe, test, expect, beforeAll } from 'bun:test'
import { AssetService } from '../AssetService'
import type { Network } from '@shapeshiftoss/types'

describe('AssetService search scoring', () => {
  beforeAll(async () => {
    await AssetService.initialize()
  }, 30_000)

  const cases: Array<{
    name: string
    search: string
    network?: Network
    expect: { symbolOrName?: string; assetIdPrefix?: string; assetId?: string }
  }> = [
    // The original bug — USDC on Gnosis must beat Morpho/Silo vault tokens
    {
      name: 'USDC on Gnosis',
      search: 'USDC',
      network: 'gnosis',
      expect: { assetId: 'eip155:100/erc20:0xddafbb505ad214d7b80b1f830fccc89b60fb7a83' },
    },
    {
      name: 'USDC on Ethereum',
      search: 'USDC',
      network: 'ethereum',
      expect: { symbolOrName: 'USDC' },
    },
    {
      name: 'USDC on Arbitrum',
      search: 'USDC',
      network: 'arbitrum',
      expect: { symbolOrName: 'USDC' },
    },
    {
      name: 'USDT on Gnosis',
      search: 'USDT',
      network: 'gnosis',
      expect: { symbolOrName: 'USDT' },
    },
    {
      name: 'USDT on Ethereum',
      search: 'USDT',
      network: 'ethereum',
      expect: { symbolOrName: 'USDT' },
    },
    {
      name: 'FOX on Ethereum',
      search: 'FOX',
      network: 'ethereum',
      expect: { assetId: 'eip155:1/erc20:0xc770eefad204b5180df6a14ee197d99d808ee52d' },
    },
    {
      name: 'FOX on Gnosis',
      search: 'FOX',
      network: 'gnosis',
      expect: { assetId: 'eip155:100/erc20:0x21a42669643f45bc0e086b8fc2ed70c23d67509d' },
    },
    {
      name: 'FOX on Arbitrum',
      search: 'FOX',
      network: 'arbitrum',
      expect: { assetId: 'eip155:42161/erc20:0xf929de51d91c77e42f5090069e0ad7a09e513c73' },
    },
    {
      name: 'WETH on Ethereum',
      search: 'WETH',
      network: 'ethereum',
      expect: { symbolOrName: 'WETH' },
    },
    {
      name: 'WETH on Gnosis',
      search: 'WETH',
      network: 'gnosis',
      expect: { symbolOrName: 'WETH' },
    },
    {
      name: 'WBTC on Ethereum',
      search: 'WBTC',
      network: 'ethereum',
      expect: { symbolOrName: 'WBTC' },
    },
    {
      name: 'DAI on Ethereum',
      search: 'DAI',
      network: 'ethereum',
      expect: { symbolOrName: 'DAI' },
    },
    {
      name: 'DAI on Gnosis',
      search: 'DAI',
      network: 'gnosis',
      expect: { symbolOrName: 'DAI' },
    },
    {
      name: 'GNO on Gnosis',
      search: 'GNO',
      network: 'gnosis',
      expect: { symbolOrName: 'GNO' },
    },
    {
      name: 'ETH on Ethereum (native)',
      search: 'ETH',
      network: 'ethereum',
      expect: { assetIdPrefix: 'eip155:1/slip44:60' },
    },
    {
      name: 'POL on Polygon (native)',
      search: 'POL',
      network: 'polygon',
      expect: { assetIdPrefix: 'eip155:137/slip44:' },
    },
    {
      name: 'AAVE on Ethereum',
      search: 'AAVE',
      network: 'ethereum',
      expect: { symbolOrName: 'AAVE' },
    },
    {
      name: 'UNI on Ethereum',
      search: 'UNI',
      network: 'ethereum',
      expect: { symbolOrName: 'UNI' },
    },
    {
      name: 'LINK on Ethereum',
      search: 'LINK',
      network: 'ethereum',
      expect: { symbolOrName: 'LINK' },
    },
    {
      name: 'XDAI on Gnosis (native)',
      search: 'XDAI',
      network: 'gnosis',
      expect: { assetIdPrefix: 'eip155:100/slip44:60' },
    },
  ]

  for (const tc of cases) {
    test(tc.name, () => {
      const results = AssetService.getInstance().searchWithScores(tc.search, tc.network)
      expect(results.length).toBeGreaterThan(0)

      const top = results[0]!
      const topAsset = top.asset

      // The top result must not be a pool token
      expect(topAsset.isPool).not.toBe(true)
      expect(topAsset.symbol).not.toContain('/')

      if (tc.expect.assetId) {
        expect(topAsset.assetId).toBe(tc.expect.assetId)
      }

      if (tc.expect.assetIdPrefix) {
        expect(topAsset.assetId).toStartWith(tc.expect.assetIdPrefix)
      }

      if (tc.expect.symbolOrName) {
        expect(topAsset.symbol.toUpperCase()).toBe(tc.expect.symbolOrName.toUpperCase())
      }
    })
  }
})
