import type { EvmSolanaNetwork } from '@shapeshiftoss/types'
import { chainIdToNetwork, EVM_SOLANA_NETWORKS, networkToChainIdMap } from '@shapeshiftoss/types'
import { calculateUsdValue, fromBaseUnit } from '@shapeshiftoss/utils'
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
    }
    baseUnitValue: string
    cryptoAmount: string
    usdAmount: string
  }>
}

export type PortfolioOutput = Array<{
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

  const { balances } = await executeGetAccount({ account, network })

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

  return fullData.map(networkData => ({
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
}

export const portfolioTool = {
  description: `Get portfolio balances across connected networks.

UI CARD DISPLAYS: token names, symbols, balances, and USD values per network.

Your role is to supplement the card, not duplicate it. Do not list or repeat any data shown in the card.

Default: Respond with one brief, natural sentence like:
- "Here's your portfolio"
- "I found your balances"
- "Here's what you're holding"

Only elaborate if the user asks about something not shown in the card.`,
  inputSchema: portfolioSchema,
  execute: executeGetPortfolio,
}
