import type { AssetId, ChainId } from '@shapeshiftoss/caip'
import { fromAssetId } from '@shapeshiftoss/caip'
import type { Asset, Network } from '@shapeshiftoss/types'
import axios from 'axios'
import { zeroAddress } from 'viem'

import { isEvmChain, isSolanaChain, isSuiChain } from '../../../../utils/chains/helpers'

import { COINGECKO_API_KEY, API_TIMEOUT, networkToNativeAsset } from './constants'

/**
 * Maps a native asset to its on-chain address format expected by CoinGecko's multi endpoint.
 *
 * - EVM chains: 0x0000000000000000000000000000000000000000 (zero address)
 * - Solana: So11111111111111111111111111111111111111112 (NATIVE_MINT/wrapped SOL)
 * - Sui: 0x2::sui::SUI (Sui native coin type)
 *
 * @returns The on-chain address for CoinGecko API, or null if chain not supported
 */
export function getNativeAssetAddress(chainId: ChainId): string | null {
  if (isSolanaChain(chainId)) {
    return 'So11111111111111111111111111111111111111112' // NATIVE_MINT
  }
  if (isEvmChain(chainId)) {
    return zeroAddress
  }
  if (isSuiChain(chainId)) {
    return '0x2::sui::SUI'
  }
  return null
}

/**
 * Fetches a native asset with current price from CoinGecko's simple price endpoint.
 * Used when the multi endpoint can't be used (e.g., in search flow where coin has no contract address).
 */
export async function getNativeAssetWithPrice(network: Network, coinId: string): Promise<Asset> {
  const nativeAsset = networkToNativeAsset[network]

  const { data } = await axios.get(
    `https://pro-api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
    {
      headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY },
      timeout: API_TIMEOUT,
    }
  )

  const price = data[coinId]?.usd?.toString() ?? '0'

  return {
    assetId: nativeAsset.assetId,
    chainId: nativeAsset.chainId,
    name: nativeAsset.name,
    network: nativeAsset.network,
    precision: nativeAsset.precision,
    price,
    symbol: nativeAsset.symbol,
    // icon: nativeAsset.icon,
  }
}

/**
 * Checks if an asset ID represents a native asset (slip44 namespace).
 */
export function isNativeAsset(assetId: AssetId): boolean {
  const { assetNamespace } = fromAssetId(assetId)
  return assetNamespace === 'slip44'
}
