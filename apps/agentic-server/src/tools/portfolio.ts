import { NETWORKS, networkToChainIdMap } from '@shapeshiftoss/types'
import { calculateUsdValue, fromBaseUnit } from '@shapeshiftoss/utils'
import { z } from 'zod'

import { getAddressForNetwork } from '../utils/walletContextSimple'
import type { WalletContext } from '../utils/walletContextSimple'

import { executeGetAccount } from './getAccount'
import { executeGetAssets } from './getAssets'

export const portfolioSchema = z.object({
  network: z.enum(NETWORKS).describe('Network name (e.g., ethereum, arbitrum, solana)'),
})

export type PortfolioInput = z.infer<typeof portfolioSchema>

export type PortfolioOutput = {
  account: string
  chainId: string
  balances: Array<{
    asset: {
      assetId: string
      name: string
      symbol: string
      precision: number
      price: string
    }
    value: string
    humanReadableValue: string
    usdValue: string
  }>
}

export async function executeGetPortfolio(
  input: PortfolioInput,
  walletContext?: WalletContext
): Promise<PortfolioOutput> {
  console.log('[getPortfolio]:', input)

  const { network } = input
  const chainId = networkToChainIdMap[network]
  const account = getAddressForNetwork(walletContext, network)

  const { balances } = await executeGetAccount({ account, network })

  const assetIds = Object.keys(balances)
  const { assets } = await executeGetAssets({ assetIds })

  const assetMap = new Map(assets.map(asset => [asset.assetId, asset]))

  return {
    account,
    chainId,
    balances: assetIds
      .map(assetId => {
        const baseUnitValue = balances[assetId] || '0'
        const asset = assetMap.get(assetId)

        if (!asset) {
          return null
        }

        const humanReadableValue = fromBaseUnit(baseUnitValue, asset.precision)
        const usdValue = calculateUsdValue(humanReadableValue, asset.price)

        return {
          asset: {
            assetId: asset.assetId,
            name: asset.name,
            symbol: asset.symbol,
            precision: asset.precision,
            price: asset.price,
          },
          value: baseUnitValue,
          humanReadableValue,
          usdValue,
        }
      })
      .filter((balance): balance is NonNullable<typeof balance> => balance !== null),
  }
}

export const portfolioTool = {
  description: 'Get user crypto balances with human-readable values and USD amounts for a specific network',
  inputSchema: portfolioSchema,
  execute: executeGetPortfolio,
}
