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
  Chain,
} from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
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

export class EvmKit {
  private walletClient: WalletClient | undefined;

  constructor(walletClient?: WalletClient | undefined) {
    this.walletClient = walletClient;
  }

  private getWalletClient(chainId: number): WalletClient {
    // Return instantiated wallet client (i.e wagmi client) if provided
    if (this.walletClient) {
      return this.walletClient;
    }

    // Else, instantiate a wallet client using mnemonic (for use in server)
    const env = import.meta?.env ? import.meta.env : process.env;
    if (!env.VITE_EVM_MNEMONIC) {
      throw new Error(
        'No wallet client provided and no mnemonic found in environment'
      );
    }

    const account = mnemonicToAccount(env.VITE_EVM_MNEMONIC as Address);
    const chain = getChainById(chainId);

    return createWalletClient({
      account,
      chain,
      transport: http(),
    });
  }

  private getPublicClient(chainId: number): PublicClient {
    const chain = getChainById(chainId);
    return createPublicClient({
      chain,
      transport: http(),
    });
  }

  getNativeBalance = tool(
    async (input: { chainId: number }): Promise<bigint> => {
      const walletClient = this.getWalletClient(input.chainId);
      const publicClient = this.getPublicClient(input.chainId);
      const account = walletClient.account;
      if (!account) throw new Error('No account found');
      return getNativeBalance(publicClient, account.address);
    },
    {
      name: 'getNativeBalance',
      description:
        'Get the native token balance of the current account, represented in wei (1e18).',
      schema: z.object({
        chainId: z.number().describe('The chain ID to get the balance on'),
      }),
    }
  );

  getErc20Balance = tool(
    async (input: { token: Address; chainId: number }): Promise<string> => {
      const walletClient = this.getWalletClient(input.chainId);
      const publicClient = this.getPublicClient(input.chainId);
      const account = walletClient.account;
      if (!account) throw new Error('No account found');

      try {
        const balance = await publicClient.readContract({
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
        chainId: z.number().describe('The chain ID to get the balance on'),
      }),
    }
  );

  getAddress = tool(
    async (input: { chainId: number }): Promise<Address> => {
      const walletClient = this.getWalletClient(input.chainId);
      const account = walletClient.account;
      if (!account) throw new Error('No account found');
      return account.address;
    },
    {
      name: 'getAddress',
      description: 'Get the address of the current account.',
      schema: z.object({
        chainId: z.number().describe('The chain ID to get the address on'),
      }),
    }
  );

  sendTransaction = tool(
    async (input: {
      to: Address;
      value: string;
      data?: Hex;
      chainId: number;
    }): Promise<Hex> => {
      const walletClient = this.getWalletClient(input.chainId);
      const publicClient = this.getPublicClient(input.chainId);
      const account = walletClient.account;
      if (!account) throw new Error('No account found');

      try {
        // First estimate gas to catch potential errors
        const [gasLimit, gasPrice] = await Promise.all([
          publicClient.estimateGas({
            account,
            to: getAddress(input.to),
            value: BigInt(input.value),
            data: input.data,
          }),
          publicClient.getGasPrice(),
        ]);

        // Now send the transaction with the estimated gas
        const hash = await walletClient.sendTransaction({
          account,
          to: getAddress(input.to),
          value: BigInt(input.value),
          data: input.data,
          chain: getChainById(input.chainId),
          gas: gasLimit,
          gasPrice,
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
        This will automatically estimate gas and catch potential errors before sending.
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
        chainId: z.number().describe('The chain ID to send the transaction on'),
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
    async (input: {
      token: Address;
      spender: Address;
      chainId: number;
    }): Promise<string> => {
      const walletClient = this.getWalletClient(input.chainId);
      const publicClient = this.getPublicClient(input.chainId);
      const account = walletClient.account;
      if (!account) throw new Error('No account found');

      try {
        const allowance = await publicClient.readContract({
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
        chainId: z.number().describe('The chain ID to check the allowance on'),
      }),
    }
  );

  approve = tool(
    async (input: {
      token: Address;
      spender: Address;
      amount: string;
      chainId: number;
    }): Promise<Hex> => {
      const walletClient = this.getWalletClient(input.chainId);
      const account = walletClient.account;
      if (!account) throw new Error('No account found');

      try {
        const data = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [getAddress(input.spender), BigInt(input.amount)],
        });

        const hash = await walletClient.sendTransaction({
          account,
          to: getAddress(input.token),
          data,
          chain: getChainById(input.chainId),
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
      `,
      schema: z.object({
        token: z.string().describe('The ERC20 token contract address'),
        spender: z.string().describe('The spender address to approve'),
        amount: z
          .string()
          .describe('The amount to approve in base units (e.g. wei)'),
        chainId: z.number().describe('The chain ID to approve on'),
      }),
    }
  );

  sendToken = tool(
    async (input: {
      token: Address;
      to: Address;
      amount: string;
      chainId: number;
    }): Promise<Hex> => {
      const walletClient = this.getWalletClient(input.chainId);
      const account = walletClient.account;
      if (!account) throw new Error('No account found');

      try {
        const data = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'transfer',
          args: [getAddress(input.to), BigInt(input.amount)],
        });

        const hash = await walletClient.sendTransaction({
          account,
          to: getAddress(input.token),
          data,
          chain: getChainById(input.chainId),
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
        chainId: z.number().describe('The chain ID to send the token on'),
      }),
    }
  );

  switchChain = tool(
    async (input: { chainId: number }): Promise<boolean> => {
      const walletClient = this.getWalletClient(input.chainId);
      const account = walletClient.account;
      if (!account) throw new Error('No account found');

      try {
        const chain = getChainById(input.chainId);

        // If we have a browser wallet client, use switchChain
        if (this.walletClient) {
          await this.walletClient.switchChain({ id: chain.id });
          return true;
        }

        // For non-browser clients (e.g. server), we can't switch chains
        // Just verify the chain is supported
        if (!chain) {
          throw new Error(`Unsupported chain ID: ${input.chainId}`);
        }

        return true;
      } catch (err) {
        console.error('Error switching chain', err);
        throw err;
      }
    },
    {
      name: 'switchChain',
      description: `
        Switch the connected wallet to the specified chain.
        This is useful for ensuring the user is on the correct network before transactions.
        Supported chains: Ethereum (1), Arbitrum (42161), Polygon (137), Optimism (10), Base (8453), Avalanche (43114), BSC (56), Gnosis (100).
      `,
      schema: z.object({
        chainId: z.number().describe('The chain ID to switch to'),
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
      this.switchChain,
    ];
  }
}
