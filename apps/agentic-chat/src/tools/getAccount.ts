import axios from 'axios';
import { Account } from '../types/account';
import { Address } from 'viem';
import { fromBaseUnit } from '@agentic-chat/utils';
import {
  toAssetId,
  arbitrumChainId,
  AssetId,
  arbitrumAssetId,
} from '@agentic-chat/caip';
import { AssetsStore } from '../stores/assets';
import { PortfolioStore } from '../stores/portfolio';
import { Asset } from '../types/asset';

export const getAccount = async (
  address: Address | undefined,
  network: string,
  assetsStore: AssetsStore,
  portfolioStore: PortfolioStore
) => {
  if (!address) {
    throw new Error('No account connected');
  }

  const baseUrl = import.meta.env[
    `VITE_UNCHAINED_${network.toUpperCase()}_HTTP_URL`
  ];

  const { data } = await axios.get<Account>(
    `${baseUrl}/api/v1/account/${address}`
  );

  const assets = data.tokens.map<Asset>((token) => ({
    assetId: toAssetId({
      // TODO(gomes): programmatic
      chainId: arbitrumChainId,
      assetNamespace: 'erc20',
      assetReference: token.contract,
    }),
    // TODO(gomes): programmatic
    chainId: arbitrumChainId,
    symbol: token.symbol,
    name: token.name,
    precision: token.decimals,
    icon: undefined, // no icon available from unchained
  }));

  assets.push({
    assetId: arbitrumAssetId,
    chainId: arbitrumChainId,
    symbol: 'ETH',
    name: 'Ethereum on Arbitrum',
    precision: 18,
    icon: 'https://rawcdn.githack.com/trustwallet/assets/32e51d582a890b3dd3135fe3ee7c20c2fd699a6d/blockchains/ethereum/info/logo.png',
  });

  assetsStore.upsert(assets);

  const portfolio = data.tokens.reduce<Record<AssetId, string>>(
    (acc, token) => {
      // TODO(gomes): programmatic
      const assetId = toAssetId({
        chainId: arbitrumChainId,
        assetNamespace: 'erc20',
        assetReference: token.contract,
      });
      acc[assetId] = fromBaseUnit(token.balance, token.decimals);
      return acc;
    },
    {}
  );

  // Process balances
  const nativeBalanceCryptoPrecision = fromBaseUnit(
    data.balance,
    18 // assume 18 decimals for all native EVM tokens
  );

  // TODO(gomes): programmatic
  portfolio[arbitrumAssetId] = nativeBalanceCryptoPrecision;

  portfolioStore.upsert(portfolio);

  return {
    assets,
    portfolio,
  };
};
