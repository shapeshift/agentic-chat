import axios from 'axios';
import { UseAccountReturnType } from 'wagmi';
import { ToolCall } from '@ai-sdk/provider-utils';
import { Account } from '../types/account';
import { fromBaseUnit } from '@agentic-chat/utils';

export const getAccount = async (
  account: UseAccountReturnType,
  toolCall: ToolCall<string, unknown>
) => {
  if (!account.address) {
    throw new Error('No account connected');
  }

  const typedToolCall = toolCall as ToolCall<'getAccount', { network: string }>;

  const env = import.meta?.env ? import.meta.env : process.env;

  const baseUrl =
    env[`VITE_UNCHAINED_${typedToolCall.args.network.toUpperCase()}_HTTP_URL`];

  const { data } = await axios.get<Account>(
    `${baseUrl}/api/v1/account/${account.address}`
  );

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
