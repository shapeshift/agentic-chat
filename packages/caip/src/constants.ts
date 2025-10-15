// Asset IDs
export const btcAssetId = 'bip122:000000000019d6689c085ae165831e93/slip44:0'
export const bchAssetId = 'bip122:000000000000000000651ef99cb9fcbe/slip44:145'
export const dogeAssetId = 'bip122:00000000001a91e3dace36e2be3bf030/slip44:3'
export const ltcAssetId = 'bip122:12a765e31ffd4059bada1e25190f6e98/slip44:2'
export const ethAssetId = 'eip155:1/slip44:60'
export const avalancheAssetId = 'eip155:43114/slip44:60'
export const optimismAssetId = 'eip155:10/slip44:60'
export const bscAssetId = 'eip155:56/slip44:60'
export const polygonAssetId = 'eip155:137/slip44:60'
export const gnosisAssetId = 'eip155:100/slip44:60'
export const arbitrumAssetId = 'eip155:42161/slip44:60'
export const arbitrumNovaAssetId = 'eip155:42170/slip44:60'
export const baseAssetId = 'eip155:8453/slip44:60'
export const solAssetId = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/slip44:501'
export const suiAssetId = 'sui:mainnet/slip44:784'
export const tronAssetId = 'tron:0x2b6653dc/slip44:195'
export const cardanoAssetId = 'cardano:1/slip44:1815'
export const cosmosAssetId = 'cosmos:cosmoshub-4/slip44:118'
export const thorchainAssetId = 'cosmos:thorchain-1/slip44:931'
export const mayachainAssetId = 'cosmos:mayachain-mainnet-v1/slip44:931'

// Chain IDs
export const btcChainId = 'bip122:000000000019d6689c085ae165831e93'
export const bchChainId = 'bip122:000000000000000000651ef99cb9fcbe'
export const dogeChainId = 'bip122:00000000001a91e3dace36e2be3bf030'
export const ltcChainId = 'bip122:12a765e31ffd4059bada1e25190f6e98'
export const ethChainId = 'eip155:1'
export const avalancheChainId = 'eip155:43114'
export const optimismChainId = 'eip155:10'
export const bscChainId = 'eip155:56'
export const polygonChainId = 'eip155:137'
export const gnosisChainId = 'eip155:100'
export const arbitrumChainId = 'eip155:42161'
export const arbitrumNovaChainId = 'eip155:42170'
export const baseChainId = 'eip155:8453'
export const cosmosChainId = 'cosmos:cosmoshub-4'
export const thorchainChainId = 'cosmos:thorchain-1'
export const mayachainChainId = 'cosmos:mayachain-mainnet-v1'
export const solanaChainId = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
export const suiChainId = 'sui:mainnet'
export const tronChainId = 'tron:0x2b6653dc'
export const cardanoChainId = 'cardano:1'

// Chain Namespace enum
export const CHAIN_NAMESPACE = {
  Evm: 'eip155',
  Utxo: 'bip122',
  CosmosSdk: 'cosmos',
  Solana: 'solana',
  Sui: 'sui',
  Tron: 'tron',
  Cardano: 'cardano',
} as const

// Chain Reference enum
export const CHAIN_REFERENCE = {
  EthereumMainnet: '1',
  BitcoinMainnet: '000000000019d6689c085ae165831e93',
  BitcoinCashMainnet: '000000000000000000651ef99cb9fcbe',
  DogecoinMainnet: '00000000001a91e3dace36e2be3bf030',
  LitecoinMainnet: '12a765e31ffd4059bada1e25190f6e98',
  CosmosHubMainnet: 'cosmoshub-4',
  ThorchainMainnet: 'thorchain-1',
  MayachainMainnet: 'mayachain-mainnet-v1',
  AvalancheCChain: '43114',
  OptimismMainnet: '10',
  BnbSmartChainMainnet: '56',
  PolygonMainnet: '137',
  GnosisMainnet: '100',
  ArbitrumMainnet: '42161',
  ArbitrumNovaMainnet: '42170',
  BaseMainnet: '8453',
  SolanaMainnet: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  SuiMainnet: 'mainnet',
  TronMainnet: '0x2b6653dc',
  CardanoMainnet: '1',
} as const

// Asset Namespace enum
export const ASSET_NAMESPACE = {
  erc20: 'erc20',
  erc721: 'erc721',
  erc1155: 'erc1155',
  bep20: 'bep20',
  bep721: 'bep721',
  bep1155: 'bep1155',
  slip44: 'slip44',
  ibc: 'ibc',
  splToken: 'token',
  suiToken: 'token',
  trc10: 'trc10',
  trc20: 'trc20',
  cardanoToken: 'token',
} as const

// Asset Reference enum
export const ASSET_REFERENCE = {
  Bitcoin: '0',
  BitcoinCash: '145',
  Litecoin: '2',
  Dogecoin: '3',
  Cosmos: '118',
  Thorchain: '931',
  Mayachain: '931',
  Ethereum: '60',
  AvalancheC: '60',
  Optimism: '60',
  BnbSmartChain: '60',
  Polygon: '60',
  Gnosis: '60',
  Arbitrum: '60',
  ArbitrumNova: '60',
  Base: '60',
  Solana: '501',
  Sui: '784',
  Tron: '195',
  Cardano: '1815',
} as const

// Valid Chain IDs by namespace
export const VALID_CHAIN_IDS: Record<ChainNamespace, readonly string[]> = Object.freeze({
  [CHAIN_NAMESPACE.Utxo]: [
    CHAIN_REFERENCE.BitcoinMainnet,
    CHAIN_REFERENCE.BitcoinCashMainnet,
    CHAIN_REFERENCE.DogecoinMainnet,
    CHAIN_REFERENCE.LitecoinMainnet,
  ],
  [CHAIN_NAMESPACE.Evm]: [
    CHAIN_REFERENCE.EthereumMainnet,
    CHAIN_REFERENCE.AvalancheCChain,
    CHAIN_REFERENCE.OptimismMainnet,
    CHAIN_REFERENCE.BnbSmartChainMainnet,
    CHAIN_REFERENCE.PolygonMainnet,
    CHAIN_REFERENCE.GnosisMainnet,
    CHAIN_REFERENCE.ArbitrumMainnet,
    CHAIN_REFERENCE.ArbitrumNovaMainnet,
    CHAIN_REFERENCE.BaseMainnet,
  ],
  [CHAIN_NAMESPACE.CosmosSdk]: [
    CHAIN_REFERENCE.CosmosHubMainnet,
    CHAIN_REFERENCE.ThorchainMainnet,
    CHAIN_REFERENCE.MayachainMainnet,
  ],
  [CHAIN_NAMESPACE.Solana]: [CHAIN_REFERENCE.SolanaMainnet],
  [CHAIN_NAMESPACE.Sui]: [CHAIN_REFERENCE.SuiMainnet],
  [CHAIN_NAMESPACE.Tron]: [CHAIN_REFERENCE.TronMainnet],
  [CHAIN_NAMESPACE.Cardano]: [CHAIN_REFERENCE.CardanoMainnet],
})

// Valid Asset Namespaces by chain namespace
export const VALID_ASSET_NAMESPACE: Record<ChainNamespace, readonly string[]> = Object.freeze({
  [CHAIN_NAMESPACE.Utxo]: [ASSET_NAMESPACE.slip44],
  [CHAIN_NAMESPACE.Evm]: [
    ASSET_NAMESPACE.slip44,
    ASSET_NAMESPACE.erc20,
    ASSET_NAMESPACE.erc721,
    ASSET_NAMESPACE.erc1155,
    ASSET_NAMESPACE.bep20,
    ASSET_NAMESPACE.bep721,
    ASSET_NAMESPACE.bep1155,
  ],
  [CHAIN_NAMESPACE.CosmosSdk]: [ASSET_NAMESPACE.ibc, ASSET_NAMESPACE.slip44],
  [CHAIN_NAMESPACE.Solana]: [ASSET_NAMESPACE.splToken, ASSET_NAMESPACE.slip44],
  [CHAIN_NAMESPACE.Sui]: [ASSET_NAMESPACE.suiToken, ASSET_NAMESPACE.slip44],
  [CHAIN_NAMESPACE.Tron]: [ASSET_NAMESPACE.trc10, ASSET_NAMESPACE.trc20, ASSET_NAMESPACE.slip44],
  [CHAIN_NAMESPACE.Cardano]: [ASSET_NAMESPACE.cardanoToken, ASSET_NAMESPACE.slip44],
})

// TypeScript types
export type ChainNamespace = (typeof CHAIN_NAMESPACE)[keyof typeof CHAIN_NAMESPACE]
export type ChainReference = (typeof CHAIN_REFERENCE)[keyof typeof CHAIN_REFERENCE]
export type AssetNamespace = (typeof ASSET_NAMESPACE)[keyof typeof ASSET_NAMESPACE]
export type AssetReference = (typeof ASSET_REFERENCE)[keyof typeof ASSET_REFERENCE]
export type ChainId = string
export type AssetId = string
