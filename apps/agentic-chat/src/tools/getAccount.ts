import axios from 'axios';
import { Account } from '../types/account';
import { Address } from 'viem';
import { fromBaseUnit } from '@agentic-chat/utils';
import { toAssetId, arbitrumChainId, AssetId } from '@agentic-chat/caip';
import { AssetsStore } from '../stores/assets';
import { PortfolioStore } from '../stores/portfolio';

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

  const assets = data.tokens.map((token) => ({
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

  portfolioStore.upsert(portfolio);

  // Process balances
  const nativeBalance = fromBaseUnit(
    data.balance,
    18 // assume 18 decimals for all native EVM tokens
  );

  const tokensBalances = data.tokens.map((token) => ({
    ...token,
    balance: fromBaseUnit(token.balance, token.decimals),
  }));

  return { nativeBalance, tokensBalances };
};
