import { WalletClient } from 'viem';
import { ToolCall } from '@ai-sdk/provider-utils';

export const switchEvmChain = async (
  walletClient: WalletClient | undefined,
  toolCall: ToolCall<string, unknown>
) => {
  if (!walletClient) {
    throw new Error('No account connected');
  }

  const typedToolCall = toolCall as ToolCall<
    'switchEvmChain',
    { chainId: number }
  >;
  const { chainId } = typedToolCall.args;

  await walletClient.switchChain({
    id: chainId,
  });

  return 'Succesfully switched chain';
};
