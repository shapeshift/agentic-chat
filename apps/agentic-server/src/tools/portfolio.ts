import { NETWORKS, networkToChainIdMap } from '@shapeshiftoss/types'
import { calculateUsdValue, fromBaseUnit } from '@shapeshiftoss/utils'
import { z } from 'zod'

import * as portfolioCache from '../lib/portfolio/cache'
import { getAddressForNetwork } from '../utils/walletContextSimple'
import type { WalletContext } from '../utils/walletContextSimple'

import { executeGetAccount } from './getAccount'
import { executeGetAssetsBasic } from './getAssets'

export const portfolioSchema = z.object({
  network: z.enum(NETWORKS).describe('Network name (e.g., ethereum, arbitrum, solana)'),
})

export type PortfolioInput = z.infer<typeof portfolioSchema>

export type PortfolioDataFull = {
  account: string
  chainId: string
  balances: Array<{
    asset: {
      assetId: string
      name: string
      symbol: string
      precision: number
      price: string
      priceChange24h?: number
    }
    baseUnitValue: string
    cryptoAmount: string
    usdAmount: string
  }>
}

export type PortfolioOutput = {
  account: string
  chainId: string
  balances: Array<{
    assetId: string
    name: string
    symbol: string
    cryptoAmount: string
    usdAmount: string
  }>
}

export async function getPortfolioData(
  input: PortfolioInput,
  walletContext?: WalletContext
): Promise<PortfolioDataFull> {
  const { network } = input
  const chainId = networkToChainIdMap[network]
  const account = getAddressForNetwork(walletContext, network)

  const cacheKey = portfolioCache.getCacheKey(account, network)
  const cached = portfolioCache.get(cacheKey)

  if (cached) {
    return cached
  }

  const { balances } = await executeGetAccount({ account, network })

  const assetIds = Object.keys(balances)
  const { assets } = await executeGetAssetsBasic({ assetIds })

  const assetMap = new Map(assets.map(asset => [asset.assetId, asset]))

  const result: PortfolioDataFull = {
    account,
    chainId,
    balances: assetIds
      .map(assetId => {
        const baseUnitValue = balances[assetId] || '0'
        const asset = assetMap.get(assetId)

        if (!asset) {
          return null
        }

        const cryptoAmount = fromBaseUnit(baseUnitValue, asset.precision)
        const usdAmount = calculateUsdValue(cryptoAmount, asset.price)

        return {
          asset: {
            assetId: asset.assetId,
            name: asset.name,
            symbol: asset.symbol,
            precision: asset.precision,
            price: asset.price,
            priceChange24h: asset.priceChange24h,
          },
          baseUnitValue,
          cryptoAmount,
          usdAmount,
        }
      })
      .filter((balance): balance is NonNullable<typeof balance> => balance !== null),
  }

  portfolioCache.set(cacheKey, result)

  return result
}

export async function executeGetPortfolio(
  input: PortfolioInput,
  walletContext?: WalletContext
): Promise<PortfolioOutput> {
  const fullData = await getPortfolioData(input, walletContext)

  return {
    account: fullData.account,
    chainId: fullData.chainId,
    balances: fullData.balances.map(balance => ({
      assetId: balance.asset.assetId,
      name: balance.asset.name,
      symbol: balance.asset.symbol,
      cryptoAmount: balance.cryptoAmount,
      usdAmount: balance.usdAmount,
    })),
  }
}

export const portfolioTool = {
  description: 'Get user crypto balances with human-readable values and USD amounts for a specific network',
  inputSchema: portfolioSchema,
  execute: executeGetPortfolio,
}
