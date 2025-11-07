import type { Network } from '@shapeshiftoss/types'
import { networkToNativeAsset } from '@shapeshiftoss/types'
import { getAddress, isAddress } from 'viem'

const networkToTrustWalletBlockchain: Partial<Record<Network, string>> = {
  ethereum: 'ethereum',
  arbitrum: 'arbitrum',
  optimism: 'optimism',
  base: 'base',
  polygon: 'polygon',
  avalanche: 'avalanchec',
  bsc: 'smartchain',
  gnosis: 'xdai',
  solana: 'solana',
}

export function getTrustWalletIconUrl(network: Network, contractAddress?: string): string | undefined {
  if (!contractAddress) {
    const nativeAsset = networkToNativeAsset[network]
    return nativeAsset?.icon ?? undefined
  }

  const blockchain = networkToTrustWalletBlockchain[network]
  if (!blockchain) return undefined

  let formattedAddress = contractAddress
  // Only validate EVM addresses, not Solana (which uses base58 encoding)
  if (network !== 'solana' && isAddress(contractAddress)) {
    formattedAddress = getAddress(contractAddress)
  }

  return `https://assets-cdn.trustwallet.com/blockchains/${blockchain}/assets/${formattedAddress}/logo.png`
}
