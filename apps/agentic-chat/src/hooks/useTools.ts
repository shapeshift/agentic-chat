import { useAccount } from 'wagmi';
import { Chain, createPublicClient, formatEther, http, PublicClient } from 'viem';
import { ToolCall } from '@ai-sdk/provider-utils';

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
  }


const useTools = () => {
  const account = useAccount();

  const handleToolCall = async ({ toolCall }: { toolCall: ToolCall<string, unknown> }) => {
    if (toolCall.toolName === 'getAddress') {
      return account.address;
    }

    if (toolCall.toolName === 'getNativeBalance') {
      if (!account.address) {
        throw new Error('No account connected');
      }

      const { chainId } = toolCall.args as { chainId: number };
      const publicClient = getPublicClient(chainId);
      const balance = await publicClient.getBalance({ address: account.address });
      return formatEther(balance);
    }
  };

  return { handleToolCall };
};

export default useTools;
