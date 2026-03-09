import type { EvmSolanaNetwork } from '@shapeshiftoss/types'
import { chainIdToNetwork, EVM_SOLANA_NETWORKS, networkToChainIdMap } from '@shapeshiftoss/types'
import { calculateUsdValue, fromBaseUnit, getPrimaryAssetId } from '@shapeshiftoss/utils'
import BigNumber from 'bignumber.js'
import { z } from 'zod'

import { getAssetPrices } from '../lib/asset/prices'
import * as portfolioCache from '../lib/portfolio/cache'
import { getAddressForNetwork } from '../utils/walletContextSimple'
import type { WalletContext } from '../utils/walletContextSimple'

import { executeGetAccount } from './getAccount'

export const portfolioSchema = z.object({
  networks: z
    .array(z.enum(EVM_SOLANA_NETWORKS))
    .optional()
    .describe('Networks to fetch portfolio for. Omit to fetch all connected networks.'),
})

export type PortfolioInput = z.infer<typeof portfolioSchema>

export type PortfolioDataFull = {
  network: EvmSolanaNetwork
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
      icon?: string
      relatedAssetKey?: string
    }
    baseUnitValue: string
    cryptoAmount: string
    usdAmount: string
  }>
}

export type PortfolioTotals = {
  overall: string
  byNetwork: Record<EvmSolanaNetwork, string>
}

export type PortfolioOutput = {
  networks: Array<{
    network: EvmSolanaNetwork
    account: string
    chainId: string
    balances: Array<{
      assetId: string
      name: string
      symbol: string
      cryptoAmount: string
      usdAmount: string
    }>
  }>
  totals: PortfolioTotals
}

export function getConnectedNetworks(walletContext?: WalletContext): EvmSolanaNetwork[] {
  if (!walletContext?.connectedWallets) return []
  return Object.keys(walletContext.connectedWallets)
    .map(chainId => chainIdToNetwork[chainId])
    .filter((n): n is EvmSolanaNetwork => !!n && EVM_SOLANA_NETWORKS.includes(n as EvmSolanaNetwork))
}

async function getPortfolioDataSingle(
  network: EvmSolanaNetwork,
  walletContext?: WalletContext
): Promise<PortfolioDataFull> {
  const chainId = networkToChainIdMap[network]
  const account = getAddressForNetwork(walletContext, network)

  const cacheKey = portfolioCache.getCacheKey(account, network)
  const cached = portfolioCache.get(cacheKey)

  if (cached) {
    return cached
  }

  const { balances } = await executeGetAccount({ address: account, network })

  const assetIds = Object.keys(balances)
  const assets = await getAssetPrices(assetIds)

  const assetMap = new Map(assets.map(asset => [asset.assetId, asset]))

  const result: PortfolioDataFull = {
    network,
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
            priceChange24h: asset.priceChange24h ?? undefined,
            icon: asset.icon,
            relatedAssetKey: getPrimaryAssetId(asset.assetId),
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

export async function getPortfolioData(
  input: { networks: EvmSolanaNetwork[] },
  walletContext?: WalletContext
): Promise<PortfolioDataFull[]> {
  return Promise.all(input.networks.map(network => getPortfolioDataSingle(network, walletContext)))
}

export async function executeGetPortfolio(
  input: PortfolioInput,
  walletContext?: WalletContext
): Promise<PortfolioOutput> {
  const networks = input.networks || getConnectedNetworks(walletContext)

  if (networks.length === 0) {
    throw new Error('No networks specified and no connected wallets found')
  }

  const fullData = await getPortfolioData({ networks }, walletContext)

  const networkResults = fullData.map(networkData => ({
    network: networkData.network,
    account: networkData.account,
    chainId: networkData.chainId,
    balances: networkData.balances.map(balance => ({
      assetId: balance.asset.assetId,
      name: balance.asset.name,
      symbol: balance.asset.symbol,
      cryptoAmount: balance.cryptoAmount,
      usdAmount: balance.usdAmount,
    })),
  }))

  const byNetwork = {} as Record<EvmSolanaNetwork, string>
  let overallTotal = new BigNumber(0)

  for (const networkData of networkResults) {
    let networkTotal = new BigNumber(0)
    for (const balance of networkData.balances) {
      networkTotal = networkTotal.plus(balance.usdAmount)
    }
    byNetwork[networkData.network] = networkTotal.toFixed(2)
    overallTotal = overallTotal.plus(networkTotal)
  }

  return {
    networks: networkResults,
    totals: {
      overall: overallTotal.toFixed(2),
      byNetwork,
    },
  }
}

export const portfolioTool = {
  description:
    'Get portfolio balances across connected networks. Returns balances per network with pre-calculated totals (overall and per-network). No UI card - format and present the data in your response. Use the provided totals directly - do not recalculate them.',
  inputSchema: portfolioSchema,
  execute: executeGetPortfolio,
}
