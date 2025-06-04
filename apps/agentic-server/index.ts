import dotenv from 'dotenv';

dotenv.config();

import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import cors from 'cors';
import express, { Request, Response } from 'express';
import z from 'zod';

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
      You make sure to execute all steps in sequence as-needed without the user needing to prompt you for the next step.
      You add line breaks in between the different steps e.g different tool calls.
      You always display quotes in a separate message.

      <amounts_and_units>
      There are two formats for amounts:
        - Precision e.g 1.1234567812345678 for ETH, 1.123456 for USDC, which is the human-readable amount.
        - Base unit, e.g 11234567812345678 for ETH, 1123456 for USDC, which is the amount in the smallest unit of the token (wei for ETH, and 6 decimals for USDC).
      All tools expect to receive and return numbers in precision format.
      Never return base unit amounts to users, and never expect them to provide such format.
      </amounts_and_units>

      <tokens_info>
      - Native assets refer to ETH, MATIC, AVAX, XDAI, and BNB. Those are *not* ERC20 tokens but native assets.
      - When users ask for anything related to a token or asset, you always use the getAccount tool in priority to get their balance and token info
      - You only use the searchTokens tool as a fallback if you don't know about a specific token, of if the user explicitly mentions that the token you are referring to is the wrong one.
      </tokens_info>

      <swap_flow>
        - You should already know about the sell asset from previous getAccount calls
        - Native assets use the following (either as fromAsset or toAsset):
          {name: 'ETH', symbol: 'ETH', address: '', decimals: 18}
        - A quote is gotten and returned to the user for confirmation using the bebopRate tool.
        - You still let users fetch a quote if they don't have enough sell asset balance, however, they won't be able to continue and execute the quote.
        - You check for allowance as a separate step after getting a quote *for tokens sell assets only, not native assets*
        - If they don't have enough allowance, it will need to be approved first using the approve tool.
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
        All balance values are in precision format.
        `,
        parameters: z.object({
          network: z
            .enum([
              'ethereum',
              'arbitrum',
              'polygon',
              'optimism',
              'base',
              'avalanche',
              'bnbsmartchain',
              'gnosis',
            ])
            .describe('The network to get the account balance on'),
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
          amountCryptoPrecision: z
            .string()
            .describe('The amount to approve in precision format'),
          chainId: z.number().describe('The chain ID to approve on'),
          decimals: z.number().describe('The number of decimals for the token'),
        }),
      },
      sendTransaction: {
        description:
          'Send a transaction to the specified address with the given value and optional calldata.',
        parameters: z.object({
          to: z.string().describe('The recipient address of the transaction'),
          // TODO(gomes): this is probably wrong and should be precision too
          valueCryptoPrecision: z
            .string()
            .describe(
              'The amount of native asset to send along with the Tx, in precision'
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
      searchTokens: {
        description: `
        Search for tokens by name or symbol
        Returns tokens matching the search term, sorted by 7-day USD volume.
        For args parsing, use text proximity to map user input to the correct network.
        `,
        parameters: z.object({
          searchTerm: z.string().describe('The search term to find tokens'),
          network: NetworkEnum.optional().describe('The network to search on'),
        }),
      },
      bebopRate: {
        description: `Fetches a swap rate from Bebop and displays it to the user.

        Returns an object with the following fields, for display to the user
        - sellAmountCryptoPrecision: The sell amount in precision format
        - buyAmountCryptoPrecision: The buy amount in precision format
        - buyAsset: Object describing the buy asset (i.e symbol, decimals, name, address)
        - sellAsset: Object describing the sell asset (i.e symbol, decimals, name, address)
        - approvalTarget: The address the funds will be spent to. Use this as the spender for allowance checks.

        **Instructions for LLM:**
        - Do not display base unit values, feeData, rate, swapperName, asset objects, allowanceTarget, or quote to the user unless specifically asked for technical details.
        - If the user requests technical details, you may display internal fields.`,
        parameters: z.object({
          chain: z
            .string()
            .describe('Chain name, e.g. ethereum, arbitrum, polygon, etc.'),
          fromAsset: z
            .object({
              address: z.string(),
              decimals: z.number(),
              symbol: z.string().optional(),
            })
            .describe('Asset to sell'),
          toAsset: z
            .object({
              address: z.string(),
              decimals: z.number(),
              symbol: z.string(),
            })
            .describe('Asset to buy'),
          sellAmountCryptoPrecision: z
            .string()
            .describe('Amount to sell in human format, e.g. 1 for 1 ETH'),
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
