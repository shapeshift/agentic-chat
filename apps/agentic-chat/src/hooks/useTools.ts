import { useAccount, useWalletClient } from 'wagmi';
import {
  Address,
  Chain,
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  Hex,
  http,
  PublicClient,
} from 'viem';
import { ToolCall } from '@ai-sdk/provider-utils';
import axios from 'axios';
import qs from 'qs';
import { BebopResponse, BebopQuote } from '@agentic-chat/tools';

import {
  arbitrum,
  mainnet,
  polygon,
  optimism,
  base,
  avalanche,
  bsc,
  gnosis,
} from 'viem/chains';
import { Asset } from './types';
import {
  ASSET_NAMESPACE,
  AssetId,
  CHAIN_NAMESPACE,
  ChainId,
} from '@shapeshiftoss/caip';
import { fromBaseUnit, toBaseUnit } from '@agentic-chat/utils';
import { useState } from 'react';

const BEBOP_ETH_MARKER = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

const getChainById = (chainId: number): Chain => {
  const chains: Record<number, Chain> = {
    [mainnet.id]: mainnet,
    [arbitrum.id]: arbitrum,
    [polygon.id]: polygon,
    [optimism.id]: optimism,
    [base.id]: base,
    [avalanche.id]: avalanche,
    [gnosis.id]: gnosis,
    [bsc.id]: bsc,
  };
  const chain = chains[chainId];
  if (!chain) throw new Error(`Unsupported chain ID: ${chainId}`);
  return chain;
};

const getPublicClient = (chainId: number): PublicClient => {
  const chain = getChainById(chainId);
  return createPublicClient({
    chain,
    transport: http(),
  });
};

const env = import.meta?.env ? import.meta.env : process.env;

const PORTALS_BASE_URL = env.VITE_PORTALS_BASE_URL;
const PORTALS_API_KEY = env.VITE_PORTALS_API_KEY;
const BEBOP_API_KEY = env.VITE_BEBOP_API_KEY;

if (!PORTALS_BASE_URL || !PORTALS_API_KEY || !BEBOP_API_KEY) {
  throw new Error('Missing env vars');
}

const useTools = () => {
  const account = useAccount();
  const { data: walletClient } = useWalletClient();
  const [bebopQuote, setBebopQuote] = useState<BebopQuote | null>(null);

  const handleToolCall = async ({
    toolCall,
  }: {
    toolCall: ToolCall<string, unknown>;
  }) => {
    if (toolCall.toolName === 'getAddress') {
      return account.address;
    }

    if (toolCall.toolName === 'getNativeBalance') {
      if (!account.address) {
        throw new Error('No account connected');
      }

      const { chainId } = toolCall.args as { chainId: number };
      const publicClient = getPublicClient(chainId);
      const balance = await publicClient.getBalance({
        address: account.address,
      });
      return balance.toString();
    }

    if (toolCall.toolName === 'getErc20Balance') {
      if (!account.address) {
        throw new Error('No account connected');
      }

      const { tokenAddress, chainId } = toolCall.args as {
        tokenAddress: string;
        chainId: number;
      };
      const publicClient = getPublicClient(chainId);
      const balance = await publicClient.readContract({
        address: getAddress(tokenAddress),
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [account.address],
      });

      return balance.toString();
    }

    if (toolCall.toolName === 'tokensSearch') {
      const { searchTerm, network } = toolCall.args as {
        searchTerm: string;
        network?: string;
      };
      const tokensUrl = `${PORTALS_BASE_URL}/v2/tokens`;
      const params = {
        search: searchTerm,
        networks: network ? [network] : [],
        platforms: ['basic', 'native'],
        sortBy: 'volumeUsd7d',
        limit: 10,
        sortDirection: 'desc',
      };

      const { data } = await axios.get(tokensUrl, {
        paramsSerializer: (params) =>
          qs.stringify(params, { arrayFormat: 'repeat' }),
        headers: {
          Authorization: `Bearer ${PORTALS_API_KEY}`,
        },
        params,
      });

      return {
        tokens: data.tokens ?? [],
        total: data.total,
      };
    }

    if (toolCall.toolName === 'bebopRate') {
      const { amount, fromAsset, toAsset, fromAddress, chain } =
        toolCall.args as Record<string, any>;

      const bebopChainsMap: Record<string, string> = {
        ethereum: 'ethereum',
        polygon: 'polygon',
        arbitrum: 'arbitrum',
        base: 'base',
        avalanche: 'avalanche',
        optimism: 'optimism',
        bsc: 'bsc',
      };

      const sellAmountCryptoBaseUnit = toBaseUnit(amount, fromAsset.precision);

      // Convert ETH symbol to Bebop's ETH marker address
      const sellTokenAddress = getAddress(
        fromAsset.symbol.trim().toUpperCase() === 'ETH'
          ? BEBOP_ETH_MARKER
          : fromAsset.address
      );
      const buyTokenAddress = getAddress(
        toAsset.symbol.trim().toUpperCase() === 'ETH'
          ? BEBOP_ETH_MARKER
          : toAsset.address
      );

      const env = import.meta?.env ? import.meta.env : process.env;

      const BEBOP_API_KEY = env.VITE_BEBOP_API_KEY || env.BEBOP_API_KEY;

      const url = `https://api.bebop.xyz/router/${
        bebopChainsMap[chain] ?? chain
      }/v1/quote`;
      const takerAddress =
        fromAddress || '0x0000000000000000000000000000000000000001';
      const reqParams = new URLSearchParams({
        sell_tokens: sellTokenAddress,
        buy_tokens: buyTokenAddress,
        sell_amounts: sellAmountCryptoBaseUnit,
        taker_address: takerAddress,
        approval_type: 'Standard',
        skip_validation: 'true',
        gasless: 'false',
        source: 'shapeshift',
      });

      const fullUrl = `${url}?${reqParams.toString()}`;
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'source-auth': BEBOP_API_KEY,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch Bebop rate: ${response.statusText}`);
      }

      const data = (await response.json()) as BebopResponse;

      if (!data.routes?.[0]?.quote) {
        throw new Error('No routes found in Bebop response');
      }

      const quote = data.routes[0].quote;

      setBebopQuote(quote);

      const buyAmountCryptoBaseUnit =
        quote.buyTokens[buyTokenAddress].amount.toString();
      const buyAmountCryptoPrecision = fromBaseUnit(
        buyAmountCryptoBaseUnit,
        toAsset.precision
      );

      const sellToken = Object.values(quote.sellTokens)[0];
      const buyToken = Object.values(quote.buyTokens)[0];
      // TODO(gomes): re-declare caip from web as a monorepo package here, but this will work for now
      // published caip is way too old and misses many chains
      const chainId = `${CHAIN_NAMESPACE.Evm}:${quote.chainId}` as ChainId;
      const sellAssetId =
        `${chainId}/${ASSET_NAMESPACE.erc20}:${sellToken.address}` as AssetId;
      const buyAssetId =
        `${chainId}/${ASSET_NAMESPACE.erc20}:${buyToken.address}` as AssetId;
      const sellAsset: Asset = {
        name: sellToken.name ?? '',
        symbol: sellToken.symbol,
        precision: sellToken.decimals,
        chainId,
        assetId: sellAssetId,
      };
      const buyAsset: Asset = {
        name: buyToken.name ?? '',
        symbol: buyToken.symbol,
        precision: buyToken.decimals,
        chainId,
        assetId: buyAssetId,
      };

      const content = {
        sellAmountCryptoPrecision: amount,
        buyAmountCryptoPrecision,
        sellAsset,
        buyAsset,
        approvalTarget: quote.approvalTarget,
      };

      return content;
    }

    if (toolCall.toolName === 'getAllowance') {
      if (!account.address) {
        throw new Error('No account connected');
      }

      const { token, spender, chainId } = toolCall.args as {
        token: string;
        spender: string;
        chainId: number;
      };

      const publicClient = getPublicClient(chainId);
      const allowance = await publicClient.readContract({
        address: getAddress(token),
        abi: erc20Abi,
        functionName: 'allowance',
        args: [account.address, getAddress(spender)],
      });

      return allowance.toString();
    }
    if (toolCall.toolName === 'approve') {
      if (!account.address || !walletClient) {
        throw new Error('No account connected');
      }

      const { token, spender, amount, chainId } = toolCall.args as {
        token: string;
        spender: string;
        amount: string;
        chainId: number;
      };

      try {
        const data = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [getAddress(spender), BigInt(amount)],
        });

        const hash = await walletClient.sendTransaction({
          account: walletClient.account,
          to: getAddress(token),
          data,
          chain: getChainById(chainId),
        });

        return hash;
      } catch (err) {
        console.error('Error approving token', err);
        throw err;
      }
    }

    if (toolCall.toolName === 'sendTransaction') {
      const { to, value, data, chainId } = toolCall.args as {
        to: Address;
        value: string;
        data: Hex;
        chainId: number;
      };

      const publicClient = getPublicClient(chainId);
      const account = walletClient?.account;
      if (!walletClient || !account?.address) {
        throw new Error('No account connected');
      }

      try {
        // First estimate gas to catch potential errors
        const [gasLimit, gasPrice] = await Promise.all([
          publicClient.estimateGas({
            account,
            to: getAddress(to),
            value: BigInt(value),
            data: data,
          }),
          publicClient.getGasPrice(),
        ]);

        // Now send the transaction with the estimated gas
        const hash = await walletClient.sendTransaction({
          account,
          to: getAddress(to),
          value: BigInt(value),
          data: data,
          chain: getChainById(chainId),
          gas: gasLimit,
          gasPrice,
        });
        return hash;
      } catch (err) {
        console.error('Error sending transaction', err);
        throw err;
      }
    }

    if (toolCall.toolName === 'executeSwap') {
      if (!bebopQuote) {
        throw new Error('No quote available');
      }

      const { tx } = bebopQuote;

      const { to, value, data, chainId } = tx;

      const publicClient = getPublicClient(chainId);
      const account = walletClient?.account;
      if (!walletClient || !account?.address) {
        throw new Error('No account connected');
      }

      try {
        // First estimate gas to catch potential errors
        const [gasLimit, gasPrice] = await Promise.all([
          publicClient.estimateGas({
            account,
            to: getAddress(to),
            value: BigInt(value),
            data: data,
          }),
          publicClient.getGasPrice(),
        ]);

        // Now send the transaction with the estimated gas
        const hash = await walletClient.sendTransaction({
          account,
          to: getAddress(to),
          value: BigInt(value),
          data: data,
          chain: getChainById(chainId),
          gas: gasLimit,
          gasPrice,
        });
        return hash;
      } catch (err) {
        console.error('Error sending transaction', err);
        throw err;
      }
    }
  };

  return { handleToolCall };
};

export default useTools;
