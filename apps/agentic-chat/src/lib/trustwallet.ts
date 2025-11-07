import type { Network } from '@shapeshiftoss/types'
import { networkToNativeAssetId } from '@shapeshiftoss/types'
import { assetService } from '@shapeshiftoss/utils'
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
  sui: 'sui',
  tron: 'tron',
  cardano: 'cardano',
}

export function getTrustWalletIconUrl(network: Network, contractAddress?: string): string | undefined {
  if (!contractAddress) {
    const assetId = networkToNativeAssetId[network]
    const nativeAsset = assetService.getAsset(assetId)
    return nativeAsset?.icon ?? undefined
  }

  const blockchain = networkToTrustWalletBlockchain[network]
  if (!blockchain) return undefined

  let formattedAddress = contractAddress
  // Only validate EVM addresses, not Solana/SUI/Cardano (which use different encoding)
  if (network !== 'solana' && network !== 'sui' && network !== 'cardano' && isAddress(contractAddress)) {
    formattedAddress = getAddress(contractAddress)
  }

  return `https://assets-cdn.trustwallet.com/blockchains/${blockchain}/assets/${formattedAddress}/logo.png`
}
