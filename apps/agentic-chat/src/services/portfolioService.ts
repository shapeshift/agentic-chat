import type { ChainId } from '@shapeshiftoss/caip'
import type { EvmSolanaNetwork } from '@shapeshiftoss/types'

import { bn, bnOrZero } from '@/lib/bignumber'
import { calculate24hDelta } from '@/lib/portfolio'
import type { PortfolioAsset, PortfolioData } from '@/types/portfolio'

type PortfolioBalanceItem = {
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
}

type PortfolioNetworkResult = {
  network: EvmSolanaNetwork
  account: string
  chainId: ChainId
  balances: PortfolioBalanceItem[]
}

const API_BASE_URL = import.meta.env.VITE_AGENTIC_SERVER_BASE_URL

export async function fetchFullPortfolio(
  evmAddress?: string,
  solanaAddress?: string,
  networks?: string[]
): Promise<PortfolioData> {
  if (!evmAddress && !solanaAddress) {
    console.log('[Portfolio] No wallet connected')
    return {
      assets: [],
      totalBalance: '0',
      delta24h: null,
      lastUpdated: Date.now(),
    }
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/portfolio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evmAddress, solanaAddress, ...(networks && { networks }) }),
    })

    if (!response.ok) {
      console.error('[Portfolio] Failed to fetch:', response.statusText)
      return {
        assets: [],
        totalBalance: '0',
        delta24h: null,
        lastUpdated: Date.now(),
      }
    }

    const results = (await response.json()) as PortfolioNetworkResult[]

    const allAssets: PortfolioAsset[] = results.flatMap(result =>
      result.balances.map(balance => ({
        assetId: balance.asset.assetId,
        chainId: result.chainId,
        name: balance.asset.name,
        symbol: balance.asset.symbol,
        icon: undefined,
        cryptoBalancePrecision: balance.cryptoAmount,
        fiatAmount: balance.usdAmount,
        price: balance.asset.price,
        priceChange24h: balance.asset.priceChange24h?.toString() ?? '0',
        allocation: 0,
      }))
    )

    const totalBalance = allAssets.reduce((sum, asset) => sum.plus(bnOrZero(asset.fiatAmount)), bn(0))

    const assetsWithAllocation = allAssets.map(asset => ({
      ...asset,
      allocation: totalBalance.gt(0) ? bnOrZero(asset.fiatAmount).div(totalBalance).times(100).toNumber() : 0,
    }))

    const delta24h = calculate24hDelta(assetsWithAllocation)

    console.log(`[Portfolio] Fetched ${allAssets.length} assets across ${results.length} networks`)

    return {
      assets: assetsWithAllocation,
      totalBalance: totalBalance.toFixed(2),
      delta24h,
      lastUpdated: Date.now(),
    }
  } catch (error) {
    console.error('[Portfolio] Error:', error)
    return {
      assets: [],
      totalBalance: '0',
      delta24h: null,
      lastUpdated: Date.now(),
    }
  }
}
