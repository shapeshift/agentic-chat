import {
  AppKitNetwork,
  gnosis,
  arbitrum,
  mainnet,
  polygon,
  optimism,
  base,
  avalanche,
  bsc,
} from '@reown/appkit/networks';

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
  mainnet,
  arbitrum,
  polygon,
  optimism,
  base,
  avalanche,
  bsc,
  gnosis,
];
