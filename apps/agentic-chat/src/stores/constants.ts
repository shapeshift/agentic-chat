import * as caip from '@shapeshiftoss/caip'

import type { AssetWithoutPrice } from './assets'

const mayaTokenAssetId = 'cosmos:mayachain-mainnet-v1/slip44:maya'

export const ethereum = Object.freeze<Readonly<AssetWithoutPrice>>({
  assetId: caip.ethAssetId,
  chainId: caip.ethChainId,
  symbol: 'ETH',
  name: 'Ethereum',
  precision: 18,
  icon: 'https://rawcdn.githack.com/trustwallet/assets/32e51d582a890b3dd3135fe3ee7c20c2fd699a6d/blockchains/ethereum/info/logo.png',
  network: 'ethereum',
})

export const bitcoin = Object.freeze<Readonly<AssetWithoutPrice>>({
  assetId: caip.btcAssetId,
  chainId: caip.btcChainId,
  symbol: 'BTC',
  name: 'Bitcoin',
  precision: 8,
  icon: 'https://rawcdn.githack.com/trustwallet/assets/b7a5f12d893fcf58e0eb1dd64478f076857b720b/blockchains/bitcoin/info/logo.png',
  network: 'bitcoin',
})

export const bitcoincash = Object.freeze<Readonly<AssetWithoutPrice>>({
  assetId: caip.bchAssetId,
  chainId: caip.bchChainId,
  symbol: 'BCH',
  name: 'Bitcoin Cash',
  precision: 8,
  icon: 'https://rawcdn.githack.com/trustwallet/assets/b7a5f12d893fcf58e0eb1dd64478f076857b720b/blockchains/bitcoincash/info/logo.png',
  network: 'bitcoincash',
})

export const dogecoin = Object.freeze<Readonly<AssetWithoutPrice>>({
  assetId: caip.dogeAssetId,
  chainId: caip.dogeChainId,
  symbol: 'DOGE',
  name: 'Dogecoin',
  precision: 8,
  icon: 'https://assets.coingecko.com/coins/images/5/large/dogecoin.png?1696501409',
  network: 'dogecoin',
})

export const litecoin = Object.freeze<Readonly<AssetWithoutPrice>>({
  assetId: caip.ltcAssetId,
  chainId: caip.ltcChainId,
  symbol: 'LTC',
  name: 'Litecoin',
  precision: 8,
  icon: 'https://rawcdn.githack.com/trustwallet/assets/32e51d582a890b3dd3135fe3ee7c20c2fd699a6d/blockchains/litecoin/info/logo.png',
  network: 'litecoin',
})

export const atom = Object.freeze<Readonly<AssetWithoutPrice>>({
  assetId: caip.cosmosAssetId,
  chainId: caip.cosmosChainId,
  symbol: 'ATOM',
  name: 'Cosmos',
  precision: 6,
  icon: 'https://rawcdn.githack.com/trustwallet/assets/b7a5f12d893fcf58e0eb1dd64478f076857b720b/blockchains/cosmos/info/logo.png',
  network: 'cosmos',
})

export const avax = Object.freeze<Readonly<AssetWithoutPrice>>({
  assetId: caip.avalancheAssetId,
  chainId: caip.avalancheChainId,
  name: 'Avalanche',
  symbol: 'AVAX',
  precision: 18,
  icon: 'https://rawcdn.githack.com/trustwallet/assets/b7a5f12d893fcf58e0eb1dd64478f076857b720b/blockchains/avalanchec/info/logo.png',
  network: 'avalanche',
})

export const thorchain = Object.freeze<Readonly<AssetWithoutPrice>>({
  assetId: caip.thorchainAssetId,
  chainId: caip.thorchainChainId,
  name: 'THORChain',
  symbol: 'RUNE',
  precision: 8,
  icon: 'https://rawcdn.githack.com/trustwallet/assets/32e51d582a890b3dd3135fe3ee7c20c2fd699a6d/blockchains/thorchain/info/logo.png',
  network: 'thorchain',
})

export const tcy = Object.freeze<Readonly<AssetWithoutPrice>>({
  assetId: caip.tcyAssetId,
  chainId: caip.thorchainChainId,
  name: 'TCY',
  symbol: 'TCY',
  precision: 8,
  icon: 'https://raw.githubusercontent.com/shapeshift/web/develop/scripts/generateAssetData/thorchain/icons/tcy-icon.png',
  network: 'thorchain',
})

export const maya = Object.freeze<Readonly<AssetWithoutPrice>>({
  assetId: mayaTokenAssetId,
  chainId: caip.mayachainChainId,
  name: 'MAYA',
  symbol: 'MAYA',
  precision: 4,
  icon: 'https://raw.githubusercontent.com/shapeshift/web/develop/scripts/generateAssetData/thorchain/icons/maya.png',
  network: 'mayachain',
})

export const mayachain = Object.freeze<Readonly<AssetWithoutPrice>>({
  assetId: caip.mayachainAssetId,
  chainId: caip.mayachainChainId,
  name: 'MAYAChain',
  symbol: 'CACAO',
  precision: 10,
  icon: 'https://raw.githubusercontent.com/shapeshift/web/develop/scripts/generateAssetData/thorchain/icons/maya.png',
  network: 'mayachain',
})

export const optimism = Object.freeze<Readonly<AssetWithoutPrice>>({
  assetId: caip.optimismAssetId,
  chainId: caip.optimismChainId,
  name: 'Ethereum',
  symbol: 'ETH',
  precision: 18,
  icon: 'https://rawcdn.githack.com/trustwallet/assets/32e51d582a890b3dd3135fe3ee7c20c2fd699a6d/blockchains/ethereum/info/logo.png',
  network: 'optimism',
})

export const bnbsmartchain = Object.freeze<Readonly<AssetWithoutPrice>>({
  assetId: caip.bscAssetId,
  chainId: caip.bscChainId,
  name: 'BNB',
  symbol: 'BNB',
  precision: 18,
  icon: 'https://rawcdn.githack.com/trustwallet/assets/b7a5f12d893fcf58e0eb1dd64478f076857b720b/blockchains/binance/info/logo.png',
  network: 'bsc',
})

export const polygon = Object.freeze<Readonly<AssetWithoutPrice>>({
  assetId: caip.polygonAssetId,
  chainId: caip.polygonChainId,
  name: 'Polygon Ecosystem Token',
  symbol: 'POL',
  precision: 18,
  icon: 'https://rawcdn.githack.com/trustwallet/assets/b7a5f12d893fcf58e0eb1dd64478f076857b720b/blockchains/polygon/info/logo.png',
  network: 'polygon',
})

export const gnosis = Object.freeze<Readonly<AssetWithoutPrice>>({
  assetId: caip.gnosisAssetId,
  chainId: caip.gnosisChainId,
  name: 'xDAI',
  symbol: 'xDAI',
  precision: 18,
  icon: 'https://assets.coingecko.com/coins/images/11062/large/Identity-Primary-DarkBG.png?1638372986',
  network: 'gnosis',
})

export const arbitrum = Object.freeze<Readonly<AssetWithoutPrice>>({
  assetId: caip.arbitrumAssetId,
  chainId: caip.arbitrumChainId,
  name: 'Ethereum',
  symbol: 'ETH',
  precision: 18,
  icon: 'https://rawcdn.githack.com/trustwallet/assets/32e51d582a890b3dd3135fe3ee7c20c2fd699a6d/blockchains/ethereum/info/logo.png',
  network: 'arbitrum',
})

export const base = Object.freeze<Readonly<AssetWithoutPrice>>({
  assetId: caip.baseAssetId,
  chainId: caip.baseChainId,
  name: 'Ethereum',
  symbol: 'ETH',
  precision: 18,
  icon: 'https://rawcdn.githack.com/trustwallet/assets/32e51d582a890b3dd3135fe3ee7c20c2fd699a6d/blockchains/ethereum/info/logo.png',
  network: 'base',
})

export const solana = Object.freeze<Readonly<AssetWithoutPrice>>({
  assetId: caip.solAssetId,
  chainId: caip.solanaChainId,
  name: 'Solana',
  symbol: 'SOL',
  precision: 9,
  icon: 'https://rawcdn.githack.com/trustwallet/assets/426526def2f327476e868ecb902c515ab17518af/blockchains/solana/info/logo.png',
  network: 'solana',
})

export const initialAssets: Record<caip.AssetId, AssetWithoutPrice> = {
  [arbitrum.assetId]: arbitrum,
  [avax.assetId]: avax,
  [base.assetId]: base,
  [bnbsmartchain.assetId]: bnbsmartchain,
  [ethereum.assetId]: ethereum,
  [gnosis.assetId]: gnosis,
  [optimism.assetId]: optimism,
  [polygon.assetId]: polygon,
  // [atom.assetId]: atom,
  // [bitcoin.assetId]: bitcoin,
  // [bitcoincash.assetId]: bitcoincash,
  // [dogecoin.assetId]: dogecoin,
  // [litecoin.assetId]: litecoin,
  // [maya.assetId]: maya,
  // [mayachain.assetId]: mayachain,
  // [solana.assetId]: solana,
  // [tcy.assetId]: tcy,
  // [thorchain.assetId]: thorchain,
}
