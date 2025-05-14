import {
  Address,
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  PublicClient,
  WalletClient,
} from "viem";
import { mnemonicToAccount,  } from "viem/accounts";
import { arbitrum } from "viem/chains";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { fromBaseUnit, toBaseUnit } from "@agentic-chat/utils";

const getNativeBalance = async (publicClient: PublicClient, address: Address): Promise<bigint> => {
  const balance = await publicClient.getBalance({ address });
  return balance;
};

export class EvmKit {
  public walletClient: WalletClient;
  public publicClient: PublicClient;

  constructor() {
    // TODO(gomes): obviously this is for dev only
    const account = mnemonicToAccount(process.env.VITE_EVM_MNM as Address);

    // TODO(gomes): support more chains
    const client = createWalletClient({
      account,
      chain: arbitrum,
      transport: http()
    })

    const publicClient = createPublicClient({
      chain: arbitrum,
      transport: http()
    })

    this.walletClient = client;
    this.publicClient = publicClient;
  }

  getNativeBalance = tool(
    async (): Promise<bigint> => {
      const account = this.walletClient.account;
      if (!account) throw new Error("No account found");
      return getNativeBalance(this.publicClient, account.address);
    },
    {
      name: "getNativeBalance",
      description: "Get the native token balance of the current account, represented in wei (1e18).",
      schema: z.object({})
    }
  );

  getAddress = tool(
    async (): Promise<Address> => {
      const account = this.walletClient.account;
      if (!account) throw new Error("No account found");
      return account.address;
    },
    {
      name: "getAddress",
      description: "Get the address of the current account.",
      schema: z.object({})
    }
  );

  sendTransaction = tool(
    async (input: { to: Address; value: string; data?: `0x${string}` }): Promise<`0x${string}`> => {
      const account = this.walletClient.account;
      if (!account) throw new Error("No account found");

      console.log({to: input.to, value: input.value, data: input.data})
      try {

      const hash = await this.walletClient.sendTransaction({
        account,
        to: getAddress(input.to),
        value: BigInt(input.value),
        data: input.data,
        chain: arbitrum,
      });
      return hash;
      } catch(err) {
        console.error("Error sending transaction", err);
        throw err
      }
    },
    {
      name: "sendTransaction",
      description: `
        Send a transaction to the specified address with the given value and optional data.
        The input value should be in wei (1e18).
        If user doesn't specify units i.e "I want to send 1 ETH", convert to wei (1e18).

        For the time being, assume all Txs are sent on Arbitrum chain (i.e if you display a Tx explorer, it should be Arbiscan)
        `,
      schema: z.object({
        to: z.string().describe("The recipient address of the transaction"),
        value: z.string().describe("The amount to send in wei (1e18)"),
        data: z.string().optional().describe("Optional data to include in the transaction (hex string starting with 0x)")
      })
    }
  );

  fromBaseUnit = tool(
    async (input: { value: string; precision: number }): Promise<string> => {
      return fromBaseUnit(input.value, input.precision);
    },
    {
      name: "fromBaseUnit",
      description: "Convert a value from base units (e.g. wei) to human-readable units (e.g. ETH).",
      schema: z.object({
        value: z.string().describe("The value in base units (e.g. wei)"),
        precision: z.number().describe("The precision of the token (e.g. 18 for ETH)")
      })
    }
  );

  toBaseUnit = tool(
    async (input: { value: string; precision: number }): Promise<string> => {
      return toBaseUnit(input.value, input.precision);
    },
    {
      name: "toBaseUnit",
      description: "Convert a value from human-readable units (e.g. ETH) to base units (e.g. wei).",
      schema: z.object({
        value: z.string().describe("The value in human-readable units (e.g. ETH)"),
        precision: z.number().describe("The precision of the token (e.g. 18 for ETH)")
      })
    }
  );

  getTools() {
    return [this.getNativeBalance, this.getAddress, this.sendTransaction, this.fromBaseUnit, this.toBaseUnit];
  }
}
