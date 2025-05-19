import {
  Address,
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  PublicClient,
  WalletClient,
  encodeFunctionData,
  erc20Abi,
  Hex,
} from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import { arbitrum } from 'viem/chains';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { fromBaseUnit, toBaseUnit } from '@agentic-chat/utils';

const getNativeBalance = async (
  publicClient: PublicClient,
  address: Address
): Promise<bigint> => {
  const balance = await publicClient.getBalance({ address });
  return balance;
};

export class EvmKit {
  public walletClient: WalletClient | undefined;
  public publicClient: PublicClient;

  constructor(walletClient?: WalletClient | undefined) {
    const env = import.meta?.env ? import.meta.env : process.env;

    const client = (() => {
      if (walletClient) {
        return walletClient;
      }

      if (!env.VITE_EVM_MNEMONIC) return;

      const account = mnemonicToAccount(env.VITE_EVM_MNEMONIC as Address);

      // TODO(gomes): support more chains
      const client = createWalletClient({
        account,
        chain: arbitrum,
        transport: http(),
      });
      return client;
    })();

    const publicClient = createPublicClient({
      chain: arbitrum,
      transport: http(),
    });

    this.walletClient = client;
    this.publicClient = publicClient;
  }

  getNativeBalance = tool(
    async (): Promise<bigint> => {
      const account = this.walletClient?.account;
      if (!account) throw new Error('No account found');
      return getNativeBalance(this.publicClient, account.address);
    },
    {
      name: 'getNativeBalance',
      description:
        'Get the native token balance of the current account, represented in wei (1e18).',
      schema: z.object({}),
    }
  );

  getErc20Balance = tool(
    async (input: { token: Address }): Promise<string> => {
      const account = this.walletClient?.account;
      if (!account) throw new Error('No account found');

      try {
        const balance = await this.publicClient.readContract({
          address: getAddress(input.token),
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [account.address],
        });

        return balance.toString();
      } catch (err) {
        console.error('Error getting ERC20 balance', err);
        throw err;
      }
    },
    {
      name: 'getErc20Balance',
      description: `Get the ERC20 token balance of the current account, represented in base units (e.g. 6 for USDC).
         Use precision/decimals as found from token search to then display this to the user in human-readable format.`,
      schema: z.object({
        token: z.string().describe('The ERC20 token contract address'),
      }),
    }
  );

  getAddress = tool(
    async (): Promise<Address> => {
      const account = this.walletClient?.account;
      if (!account) throw new Error('No account found');
      return account.address;
    },
    {
      name: 'getAddress',
      description: 'Get the address of the current account.',
      schema: z.object({}),
    }
  );

  sendTransaction = tool(
    async (input: { to: Address; value: string; data?: Hex }): Promise<Hex> => {
      const account = this.walletClient?.account;
      if (!account) throw new Error('No account found');

      try {
        if (!this.walletClient) throw new Error('No wallet client found');

        const hash = await this.walletClient.sendTransaction({
          account,
          to: getAddress(input.to),
          value: BigInt(input.value),
          data: input.data,
          chain: arbitrum,
        });
        return hash;
      } catch (err) {
        console.error('Error sending transaction', err);
        throw err;
      }
    },
    {
      name: 'sendTransaction',
      description: `
        Send a transaction to the specified address with the given value and optional data.
        The input value should be in wei (1e18).
        If user doesn't specify units i.e "I want to send 1 ETH", convert to wei (1e18).

        For the time being, assume all Txs are sent on Arbitrum chain (i.e if you display a Tx explorer, it should be Arbiscan)
        `,
      schema: z.object({
        to: z.string().describe('The recipient address of the transaction'),
        value: z.string().describe('The amount to send in wei (1e18)'),
        data: z
          .string()
          .optional()
          .describe(
            'Optional data to include in the transaction (hex string starting with 0x)'
          ),
      }),
    }
  );

  fromBaseUnit = tool(
    async (input: { value: string; precision: number }): Promise<string> => {
      return fromBaseUnit(input.value, input.precision);
    },
    {
      name: 'fromBaseUnit',
      description:
        'Convert a value from base units (e.g. wei) to human-readable units (e.g. ETH).',
      schema: z.object({
        value: z.string().describe('The value in base units (e.g. wei)'),
        precision: z
          .number()
          .describe('The precision of the token (e.g. 18 for ETH)'),
      }),
    }
  );

  toBaseUnit = tool(
    async (input: { value: string; precision: number }): Promise<string> => {
      return toBaseUnit(input.value, input.precision);
    },
    {
      name: 'toBaseUnit',
      description:
        'Convert a value from human-readable units (e.g. ETH) to base units (e.g. wei).',
      schema: z.object({
        value: z
          .string()
          .describe('The value in human-readable units (e.g. ETH)'),
        precision: z
          .number()
          .describe('The precision of the token (e.g. 18 for ETH)'),
      }),
    }
  );

  getAllowance = tool(
    async (input: { token: Address; spender: Address }): Promise<string> => {
      const account = this.walletClient?.account;
      if (!account) throw new Error('No account found');

      try {
        const allowance = await this.publicClient.readContract({
          address: getAddress(input.token),
          abi: erc20Abi,
          functionName: 'allowance',
          args: [account.address, getAddress(input.spender)],
        });

        return allowance.toString();
      } catch (err) {
        console.error('Error checking allowance', err);
        throw err;
      }
    },
    {
      name: 'getAllowance',
      description:
        'Check the ERC20 token allowance for a spender address. Returns the allowance amount in base units (e.g. wei).',
      schema: z.object({
        token: z.string().describe('The ERC20 token contract address'),
        spender: z
          .string()
          .describe('The spender address to check allowance for'),
      }),
    }
  );

  approve = tool(
    async (input: {
      token: Address;
      spender: Address;
      amount: string;
    }): Promise<Hex> => {
      const account = this.walletClient?.account;
      if (!account) throw new Error('No account found');

      try {
        if (!this.walletClient) throw new Error('No wallet client found');

        const data = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [getAddress(input.spender), BigInt(input.amount)],
        });

        const hash = await this.walletClient.sendTransaction({
          account,
          to: getAddress(input.token),
          data,
          chain: arbitrum,
        });

        return hash;
      } catch (err) {
        console.error('Error approving token', err);
        throw err;
      }
    },
    {
      name: 'approve',
      description: `
        Approve a spender to spend ERC20 tokens on behalf of the current account.
        The amount should be in base units (e.g. wei).
        If user doesn't specify units i.e "I want to approve 1 USDC", convert to base units using the token's precision.

        For the time being, assume all Txs are sent on Arbitrum chain (i.e if you display a Tx explorer, it should be Arbiscan)
      `,
      schema: z.object({
        token: z.string().describe('The ERC20 token contract address'),
        spender: z.string().describe('The spender address to approve'),
        amount: z
          .string()
          .describe('The amount to approve in base units (e.g. wei)'),
      }),
    }
  );

  sendToken = tool(
    async (input: {
      token: Address;
      to: Address;
      amount: string;
    }): Promise<Hex> => {
      const account = this.walletClient?.account;
      if (!account) throw new Error('No account found');

      try {
        if (!this.walletClient) throw new Error('No wallet client found');

        const data = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'transfer',
          args: [getAddress(input.to), BigInt(input.amount)],
        });

        const hash = await this.walletClient.sendTransaction({
          account,
          to: getAddress(input.token),
          data,
          chain: arbitrum,
        });

        return hash;
      } catch (err) {
        console.error('Error sending token', err);
        throw err;
      }
    },
    {
      name: 'sendToken',
      description: `
        Send ERC20 tokens to the specified address.
        The amount should be in base units (e.g. wei).
        If user doesn't specify units i.e "I want to send 1 USDC", convert to base units using the token's precision.

        Use token search tool to find the right address for the token if not known.
      `,
      schema: z.object({
        token: z.string().describe('The ERC20 token contract address'),
        to: z.string().describe('The recipient address'),
        amount: z
          .string()
          .describe('The amount to send in base units (e.g. wei)'),
      }),
    }
  );

  getTools() {
    return [
      this.getNativeBalance,
      this.getErc20Balance,
      this.getAddress,
      this.sendTransaction,
      this.fromBaseUnit,
      this.toBaseUnit,
      this.getAllowance,
      this.approve,
      this.sendToken,
    ];
  }
}
