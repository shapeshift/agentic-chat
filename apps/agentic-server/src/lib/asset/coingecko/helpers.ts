import type { ChainId } from '@shapeshiftoss/caip'
import { zeroAddress } from 'viem'

import { isEvmChain, isSolanaChain, isSuiChain } from '../../../utils/chains/helpers'

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
