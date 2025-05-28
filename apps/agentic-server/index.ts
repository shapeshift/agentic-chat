import dotenv from 'dotenv';

dotenv.config();

import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import express, { Request, Response } from 'express';
import z from 'zod';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors())

const NetworkEnum = z.enum(['avalanche', 'ethereum', 'polygon', 'bsc', 'optimism', 'arbitrum', 'gnosis', 'base']);

const openai = createOpenAI({ apiKey: process.env.VITE_OPENAI_API_KEY })

app.post('/', async (req: Request, res: Response) => {
  const { messages } = req.body;
  const result = streamText({
    messages,
    system: `
      You are a powerful agentic wallet assistant.7 Sonnet. You always refer to yourself as "ShapeShift" agent.

      You always respond in a friendly, helpful, and concise manner, using markdown.

      Your main goal is to assist users in getting quotes for swapping tokens, checking balances, providing information about their wallet, and letting them execute swaps with their wallet.

      You have tools at your disposal to help you achieve this.

      You always reply to users with numbers in human-readable format, and you use the knowledge at your dispoal to convert it to full base unit within tools as necessary.

      <swap_flow>
        A quote is gotten and returned to the user for confirmation using the bebopRate tool.
        After they confirm their intent to swap, you check if the user has enough balance to perform the swap using the getAllowance() tool.
        If they don't, it will need to be approved first using the approve tool.
        If they do have enough (e.g after approving, or after checking for their allowance initially), you proceed to call the executeSwap() tool.
      </swap_flow>

      <wallet_actions>
      All tools that are wallet actions (approve, sendTransaction), should be run only after the user explicitly confirms their intent to perform that specific action.
      e.g for approvals, you should ask for their confirmation to approve that specific amount.
      </wallet_actions>
    `,
    model: openai('gpt-4o'),
    tools: {
      getAddress: {
        description: 'Returns the user address across all EVM chains',
        parameters: z.object({
        }),
      },
      getNativeBalance: {
        description: 'Returns the native token balance of the current account, represented in base unit (e.g 1e18 for ETH).',
        parameters: z.object({
          chainId: z.number().describe('The chain ID to get the balance on'),
        }),
      },
      getErc20Balance: {
        description: `
        Returns the ERC20 token balance of the current account, represented in base units (e.g 1e18 for ETH).
        Always display to the user in human-readable format in your final message.
        If unaware of the token's decimals, use the decimals property from the tokensSearch tools to convert back to human-readable when displaying to the user.
        `,
        parameters: z.object({
          tokenAddress: z.string().describe('The ERC20 token contract address'),
          chainId: z.number().describe('The chain ID to get the balance on'),
        }),
      },
      getAllowance: {
        description: 'Get the allowance of an ERC20 token for a specific spender.',
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
        description: 'Send a transaction to the specified address with the given value and optional calldata.',
        parameters: z.object({
        to: z.string().describe('The recipient address of the transaction'),
        value: z.string().describe('The amount to send in wei (1e18)'),
        amount: z.string().describe('The native asset amount to send alongside the transaction in base units'),
        chainId: z.number().describe('The chain ID to send the transaction on'),
        }),
      },
      executeSwap: {
        description: 'Sends a transaction which executes the swap the user has confirmed.',
        parameters: z.object({
        }),
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
        - buyAsset: Object describing the buy asset (assetId, chainId, symbol, name, precision). **Use this as necessary**
        - sellAsset: Object describing the sell asset (assetId, chainId, symbol, name, precision). **Use this as necessary**
        - approvalTarget: The address the funds will be spent to. Use this as the spender for allowance checks.

        **Instructions for LLM:**
        - Only display the precision values (buyAmountCryptoPrecision, sellAmountCryptoPrecision, or buyAmount) to the user.
        - Do not display base unit values, feeData, rate, swapperName, asset objects, allowanceTarget, or quote to the user unless specifically asked for technical details.
        - If the user requests technical details, you may show base unit values and other internal fields.`,
        parameters: z.object({
          chain: z.string().describe('Chain name, e.g. ethereum, arbitrum, polygon, etc.'),
          fromAsset: z.object({
            address: z.string(),
            precision: z.number(),
            name: z.string(),
            symbol: z.string(),
          }).describe('Asset to sell'),
          toAsset: z.object({
            address: z.string(),
            precision: z.number(),
            name: z.string(),
            symbol: z.string(),
          }).describe('Asset to buy'),
          amount: z.string().describe('Amount in human format, e.g. 1 for 1 ETH'),
          fromAddress: z.string().optional().describe('The address the user is swapping from (optional). Also referred to as "sell address", and can be gotten using the getAddress() tool if not explicitly provided.'),
        }),
      },
    }
  });

  result.pipeDataStreamToResponse(res);
});

app.listen(8080, () => {
  console.log(`agentic-server listening on port ${8080}`);
});
