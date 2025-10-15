import type { Asset, Network } from '@shapeshiftoss/types'
import axios from 'axios'

import { COINGECKO_API_KEY, API_TIMEOUT, networkToNativeAsset } from './constants'

type SimplePriceResponse = Record<string, { usd: number }>

/**
 * Fetches current price for a native asset using CoinGecko's /simple/price endpoint.
 *
 * This is the lightest-weight endpoint for getting current prices. We use hardcoded
 * native asset definitions (name, symbol, precision, icon, etc.) from our types package
 * and supplement with real-time price data from this endpoint.
 *
 * Works for all native assets across all 18 supported networks.
 *
 * @param coinId - CoinGecko coin ID (e.g., 'bitcoin', 'ethereum', 'solana')
 * @param network - Target network for the asset
 * @returns Asset with current price and metadata
 */
export const getNativeAssetWithPrice = async (coinId: string, network: Network): Promise<Asset> => {
  const nativeAsset = networkToNativeAsset[network]

  if (!nativeAsset) {
    throw new Error(`No native asset found for network: ${network}`)
  }

  const { data } = await axios.get<SimplePriceResponse>('https://pro-api.coingecko.com/api/v3/simple/price', {
    headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY },
    params: { ids: coinId, vs_currencies: 'usd' },
    timeout: API_TIMEOUT,
  })

  const price = data[coinId]?.usd?.toString() ?? '0'

  return {
    ...nativeAsset,
    price,
  }
}
