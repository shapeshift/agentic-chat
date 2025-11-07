import type { AssetId, ChainId } from '@shapeshiftoss/caip'
import { fromAssetId } from '@shapeshiftoss/caip'
import type { Asset, Network } from '@shapeshiftoss/types'
import { networkToNativeAssetId } from '@shapeshiftoss/types'
import { decodeAssetData } from '@shapeshiftoss/utils'
import type { EncodedAssetData } from '@shapeshiftoss/utils'
import encodedAssetData from '@shapeshiftoss/utils/src/assetData/encodedAssetData.json'
import axios from 'axios'
import { zeroAddress } from 'viem'

import { isEvmChain, isSolanaChain, isSuiChain } from '../../../utils/chains/helpers'

import { COINGECKO_API_KEY, API_TIMEOUT } from './constants'

// Decode asset data once at module load (same pattern as chat app)
const { assetData: assetsById } = decodeAssetData(encodedAssetData as unknown as EncodedAssetData)

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

export async function getNativeAssetWithPrice(coinId: string, network: Network): Promise<Asset> {
  const assetId = networkToNativeAssetId[network]
  const staticAsset = assetsById[assetId]

  if (!staticAsset) {
    throw new Error(`Native asset not found for network: ${network}`)
  }

  const { data } = await axios.get(
    `https://pro-api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
    {
      headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY },
      timeout: API_TIMEOUT,
    }
  )

  const price = data[coinId]?.usd?.toString() ?? '0'

  return {
    assetId: staticAsset.assetId,
    chainId: staticAsset.chainId,
    name: staticAsset.name,
    network,
    precision: staticAsset.precision,
    price,
    symbol: staticAsset.symbol,
    icon: staticAsset.icon ?? '',
  }
}

/**
 * Checks if an asset ID represents a native asset (slip44 namespace).
 */
export function isNativeAsset(assetId: AssetId): boolean {
  const { assetNamespace } = fromAssetId(assetId)
  return assetNamespace === 'slip44'
}
