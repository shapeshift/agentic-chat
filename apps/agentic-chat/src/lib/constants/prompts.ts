export interface ExamplePrompt {
  template: string;
  sampleVariables: Record<string, string>;
}

export const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  {
    template:
      'Swap {amountCryptoPrecision} {sellAssetSymbol} to {buyAssetSymbol} on {evmNetworkName}',
    sampleVariables: {
      amountCryptoPrecision: '0.01',
      sellAssetSymbol: 'USDC',
      buyAssetSymbol: 'ETH',
      evmNetworkName: 'Arbitrum',
    },
  },
  {
    template:
      'Swap {sellAmountUsd} of {sellAssetSymbol} to {buyAssetSymbol} on {evmNetworkName}',
    sampleVariables: {
      sellAmountUsd: '1$',
      sellAssetSymbol: 'ETH',
      buyAssetSymbol: 'USDC',
      evmNetworkName: 'Arbitrum',
    },
  },
  {
    template: "What's my address?",
    sampleVariables: {},
  },
  {
    template: "What's my {asset} balance over {evmNetworks} networks",
    sampleVariables: {
      asset: 'native asset',
      evmNetworks: 'all',
    },
  },
];
