import type { ChainId } from '@shapeshiftoss/caip'
import {
  ethChainId,
  polygonChainId,
  arbitrumChainId,
  baseChainId,
  avalancheChainId,
  optimismChainId,
  bscChainId,
  gnosisChainId,
  solanaChainId,
} from '@shapeshiftoss/caip'

export const NETWORK_ICONS: Record<ChainId, string> = {
  [ethChainId]:
    'https://rawcdn.githack.com/trustwallet/assets/32e51d582a890b3dd3135fe3ee7c20c2fd699a6d/blockchains/ethereum/info/logo.png',
  [optimismChainId]: 'https://assets.coingecko.com/coins/images/25244/large/Optimism.png?1660904599',
  [arbitrumChainId]:
    'https://raw.githubusercontent.com/trustwallet/assets/b7a5f12d893fcf58e0eb1dd64478f076857b720b/blockchains/arbitrum/info/logo.png',
  [baseChainId]:
    'https://rawcdn.githack.com/base-org/brand-kit/8984fe6e08be3058fd7cf5cd0b201f8b92b5a70e/logo/symbol/Base_Symbol_Blue.png',
  [polygonChainId]:
    'https://rawcdn.githack.com/trustwallet/assets/b7a5f12d893fcf58e0eb1dd64478f076857b720b/blockchains/polygon/info/logo.png',
  [gnosisChainId]: 'https://assets.coingecko.com/asset_platforms/images/11062/large/Aatar_green_white.png?1643204471',
  [avalancheChainId]:
    'https://rawcdn.githack.com/trustwallet/assets/b7a5f12d893fcf58e0eb1dd64478f076857b720b/blockchains/avalanchec/info/logo.png',
  [bscChainId]:
    'https://rawcdn.githack.com/trustwallet/assets/b7a5f12d893fcf58e0eb1dd64478f076857b720b/blockchains/binance/info/logo.png',
  [solanaChainId]:
    'https://rawcdn.githack.com/trustwallet/assets/426526def2f327476e868ecb902c515ab17518af/blockchains/solana/info/logo.png',
}
