import dotenv from 'dotenv';

dotenv.config();

import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import express, { Request, Response } from 'express';
import z from 'zod';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors());

const NetworkEnum = z.enum([
  'avalanche',
  'ethereum',
  'polygon',
  'bsc',
  'optimism',
  'arbitrum',
  'gnosis',
  'base',
]);

const openai = createOpenAI({
  // change me to VITE_VENICE_API_KEY if you want to use venice, and uncomment the below, then instantiate openai() with the model you want in `model` below
  apiKey: process.env.VITE_OPENAI_API_KEY,
  // baseURL: 'https://api.venice.ai/api/v1',
});

app.post('/', async (req: Request, res: Response) => {
  const { messages } = req.body;
  const result = streamText({
    messages,
    system: `
      You are a powerful agentic wallet assistant. You always refer to yourself as "ShapeShift" agent.

      Your main goal is to assist users in getting quotes for swapping tokens, providing info about their wallet such as balances, and letting them execute swaps.

      You have tools at your disposal to help you achieve this.

      You always reply in a friendly, helpful, and concise manner, using markdown.

      You think in terms of steps.
      Every tool call is a step, and you always return a AI message explaining the intermediary action that you are taking, as you take it.
      Add line breaks in between the different steps.
      You always display quotes in a separate message.

      <amounts_and_units>
      All tools expect to receive and return numbers in base unit
      You always assume the user is referring to numbers in human format
      You ensure user input is converted into base unit for use in tools, and tools responses are converted back to human-readable format before displaying to the user.
      You use the decimals/precision properties from previous or current tool calls to do this conversion, as different assets have different decimals.
      You never use scientific notation anywhere, ever. When converting to base unit, you simply multiply the human-readable number by 10 to the power of the asset's decimals, and the other way around when converting down to human format.

      Examples:
        - 1 ETH = 100000000000000000 in base unit (18 decimals)
        - 1 USDC = 1000000 in base unit (6 decimals)
      </amounts_and_units>

      <tokens_info>
      When users ask for anything related to a token or asset, you always use the getAccount tool in priority to get their balance and token info.
      You always assume the user is referring to tokens they are holding when you don't know about a specific token (i.e ensure you have called getaccount()), and only use the tokensSearch tool as a fallback if you don't know about a specific token,
      of if the user explicitly mentions that the token you are referring to is the wrong one.
      </tokens_info>

      <swap_flow>
        - You always ensure that you know about the from and to asset needed for input, either with getaccount or tokensSearch tools.
        - A quote is gotten and returned to the user for confirmation using the bebopRate tool.
        - You don't automatically fetch a quote if the user doesn't have enough sell asset balance. You inform them of that, but still let them fetch a quote if they want to, however, they won't be able to continue and execute the quote.
        - You check if the user has enough allowance to perform the swap using the getAllowance() tool.
        - If they don't, it will need to be approved first using the approve tool.
        - If they do have enough (e.g after approving, or after checking for their allowance initially), you proceed to call the executeSwap() tool.
        - Every time the user asks for a specific swap/quote, we will get a new quote using the bebopRate tool.
      </swap_flow>

      <wallet_actions>
      All tools that are wallet actions (approve, sendTransaction), should be run only after the user explicitly confirms their intent to perform that specific action.
      e.g for approvals, you should ask for their confirmation to approve that specific amount.
      </wallet_actions>
    `,
    model: openai('gpt-4o-mini'),
    tools: {
      switchEvmChain: {
        description:
          'Switches the current EVM chainId to the specified chainId',
        parameters: z.object({
          chainId: z.number().describe('The chain ID to switch to'),
        }),
      },
      getAddress: {
        description: 'Returns the user address across all EVM chains',
        parameters: z.object({}),
      },
      getAccount: {
        description: `
        Fetches the current account native balance for a given chain, as well as tokens balances and their info (balance, contract address, decimals, name, symbol).
        All balance values are in base unit. If you need to convert these back to human-readable format for display purposes, you can use the decimals property from the tokens info.
        `,
        parameters: z.object({
          network: z.enum(['ethereum', 'arbitrum', 'polygon', 'optimism', 'base', 'avalanche', 'bnbsmartchain', 'gnosis']).describe('The network to get the account balance on'),
        }),
      },
      getNativeBalance: {
        description:
          'Returns the native token balance of the current account, represented in base unit (e.g 1e18 for ETH).',
        parameters: z.object({
          chainId: z.number().describe('The chain ID to get the balance on'),
        }),
      },
      getErc20Balance: {
        description: `
        Returns the ERC20 token balance of the current account, represented in base units (e.g 1e18 for ETH).
        Always display to the user in human-readable format in your final message i.e bring precision down to human.
        If unaware of the token's decimals, use the decimals property from the tokensSearch tools to convert back to human-readable when displaying to the user.
        `,
        parameters: z.object({
          tokenAddress: z.string().describe('The ERC20 token contract address'),
          chainId: z.number().describe('The chain ID to get the balance on'),
        }),
      },
      getAllowance: {
        description:
          'Get the allowance of an ERC20 token for a specific spender.',
        parameters: z.object({
          token: z.string().describe('The ERC20 token contract address'),
          spender: z.string().describe('The address of the spender'),
          chainId: z.number().describe('The chain ID to get the allowance on'),
        }),
      },
      approve: {
        description: 'Approve an ERC20 token for a specific spender.',
        parameters: z.object({
          token: z.string().describe('The ERC20 token contract address'),
          spender: z.string().describe('The address of the spender'),
          amount: z.string().describe('The amount to approve in base units'),
          chainId: z.number().describe('The chain ID to approve on'),
        }),
      },
      sendTransaction: {
        description:
          'Send a transaction to the specified address with the given value and optional calldata.',
        parameters: z.object({
          to: z.string().describe('The recipient address of the transaction'),
          value: z.string().describe('The amount to send in wei (1e18)'),
          amount: z
            .string()
            .describe(
              'The native asset amount to send alongside the transaction in base units'
            ),
          chainId: z
            .number()
            .describe('The chain ID to send the transaction on'),
        }),
      },
      executeSwap: {
        description:
          'Sends a transaction which executes the swap the user has confirmed.',
        parameters: z.object({}),
      },
      tokensSearch: {
        description: `
        Search for tokens using the Portals API /v2/tokens endpoint.
        Returns tokens matching the search term, sorted by 7-day USD volume.
        Use text proximity to map user input to the correct network.
        `,
        parameters: z.object({
          searchTerm: z.string().describe('The search term to find tokens'),
          network: NetworkEnum.optional().describe('The network to search on'),
        }),
      },
      bebopRate: {
        description: `Fetches a swap rate from Bebop and displays it to the user.

        Returns an object with the following fields, for display to the user
        - sellAmountCryptoPrecision: The sell amount in human-readable precision (e.g., 1 for 1 USDC). **Display this to the user.**
        - buyAmountCryptoPrecision: The buy amount in human-readable precision (e.g., 0.032413 for 0.032413 USDC). **Display this to the user.**
        - buyAsset: Object describing the buy asset (i.e symbol, decimals, name, address)
        - sellAsset: Object describing the sell asset (i.e symbol, decimals, name, address)
        - approvalTarget: The address the funds will be spent to. Use this as the spender for allowance checks.

        **Instructions for LLM:**
        - Only display the precision values (buyAmountCryptoPrecision, sellAmountCryptoPrecision, or buyAmount) to the user.
        - Do not display base unit values, feeData, rate, swapperName, asset objects, allowanceTarget, or quote to the user unless specifically asked for technical details.
        - If the user requests technical details, you may show base unit values and other internal fields.`,
        parameters: z.object({
          chain: z
            .string()
            .describe('Chain name, e.g. ethereum, arbitrum, polygon, etc.'),
          fromAsset: z
            .object({
              address: z.string(),
              decimals: z.number(),
              name: z.string(),
              symbol: z.string(),
            })
            .describe('Asset to sell'),
          toAsset: z
            .object({
              address: z.string(),
              decimals: z.number(),
              name: z.string(),
              symbol: z.string(),
            })
            .describe('Asset to buy'),
          amount: z
            .string()
            .describe('Amount in base unit, e.g. 1 for 1 ETH'),
          fromAddress: z
            .string()
            .describe(
              'The address the user is swapping from. Also referred to as "sell address", and should be gotten using the getAddress() tool beforehand'
            ),
        }),
      },
    },
  });

  result.pipeDataStreamToResponse(res);
});

app.listen(8080, () => {
  console.log(`agentic-server listening on port ${8080}`);
});
