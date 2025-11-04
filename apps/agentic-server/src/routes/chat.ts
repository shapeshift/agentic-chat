import {
  arbitrumChainId,
  avalancheChainId,
  baseChainId,
  bscChainId,
  ethChainId,
  gnosisChainId,
  optimismChainId,
  polygonChainId,
  solanaChainId,
} from '@shapeshiftoss/caip'
import { convertToModelMessages, stepCountIs, streamText } from 'ai'
import type { Context } from 'hono'

import { supportedChainsContext } from '../context'
import { anthropic } from '../models'
import { getAccountTool } from '../tools/getAccount'
import { getAllowanceTool } from '../tools/getAllowance'
import { getAssetsTool } from '../tools/getAssets'
import { getTransactionHistoryTool } from '../tools/getTransactionHistory'
import { initiateSwapTool, initiateSwapUsdTool } from '../tools/initiateSwap'
import { mathCalculator } from '../tools/mathCalculator'
import { portfolioTool } from '../tools/portfolio'
import { switchNetworkTool } from '../tools/switchNetwork'
import type { WalletContext } from '../utils/walletContextSimple'

function buildWalletContext(evmAddress?: string, solanaAddress?: string): WalletContext {
  const connectedWallets: Record<string, { address: string }> = {}

  // Add EVM wallet - same address works across all EVM chains
  if (evmAddress) {
    const evmChains = [
      ethChainId,
      arbitrumChainId,
      optimismChainId,
      baseChainId,
      polygonChainId,
      avalancheChainId,
      bscChainId,
      gnosisChainId,
    ]

    evmChains.forEach(chainId => {
      connectedWallets[chainId] = { address: evmAddress }
    })
  }

  // Add Solana wallet
  if (solanaAddress) {
    connectedWallets[solanaChainId] = { address: solanaAddress }
  }

  return { connectedWallets }
}

function buildTools(walletContext: WalletContext) {
  return {
    mathCalculatorTool: {
      ...mathCalculator,
      execute: (args: Parameters<typeof mathCalculator.execute>[0]) => {
        console.log('[Tool] mathCalculatorTool:', JSON.stringify(args, null, 2))
        return mathCalculator.execute(args)
      },
    },
    getAssetsTool: {
      ...getAssetsTool,
      execute: (args: Parameters<typeof getAssetsTool.execute>[0]) => {
        console.log('[Tool] getAssetsTool:', JSON.stringify(args, null, 2))
        return getAssetsTool.execute(args)
      },
    },
    getAccountTool: {
      ...getAccountTool,
      execute: (args: Parameters<typeof getAccountTool.execute>[0]) => {
        console.log('[Tool] getAccountTool:', JSON.stringify(args, null, 2))
        return getAccountTool.execute(args)
      },
    },
    getAllowanceTool: {
      description: getAllowanceTool.description,
      inputSchema: getAllowanceTool.inputSchema,
      execute: async (args: Parameters<typeof getAllowanceTool.execute>[0]) => {
        console.log('[Tool] getAllowanceTool:', JSON.stringify(args, null, 2))
        const chainId = args?.asset?.chainId
        const from = args?.from ?? (chainId ? walletContext.connectedWallets?.[chainId]?.address : undefined)
        if (!from) {
          throw new Error('Missing `from` address. Connect a wallet or specify `from`.')
        }
        return getAllowanceTool.execute({ ...args, from })
      },
    },
    getTransactionHistoryTool: {
      description: getTransactionHistoryTool.description,
      inputSchema: getTransactionHistoryTool.inputSchema,
      execute: async (args: Parameters<typeof getTransactionHistoryTool.execute>[0]) => {
        console.log('[Tool] getTransactionHistoryTool:', JSON.stringify(args, null, 2))
        return getTransactionHistoryTool.execute(args, walletContext)
      },
    },
    portfolioTool: {
      description: portfolioTool.description,
      inputSchema: portfolioTool.inputSchema,
      execute: async (args: Parameters<typeof portfolioTool.execute>[0]) => {
        console.log('[Tool] portfolioTool:', JSON.stringify(args, null, 2))
        return portfolioTool.execute(args, walletContext)
      },
    },
    initiateSwapTool: {
      description: initiateSwapTool.description,
      inputSchema: initiateSwapTool.inputSchema,
      execute: async (args: Parameters<typeof initiateSwapTool.execute>[0]) => {
        console.log('[Tool] initiateSwapTool:', JSON.stringify(args, null, 2))
        return initiateSwapTool.execute(args, walletContext)
      },
    },
    initiateSwapUsdTool: {
      description: initiateSwapUsdTool.description,
      inputSchema: initiateSwapUsdTool.inputSchema,
      execute: async (args: Parameters<typeof initiateSwapUsdTool.execute>[0]) => {
        console.log('[Tool] initiateSwapUsdTool:', JSON.stringify(args, null, 2))
        return initiateSwapUsdTool.execute(args, walletContext)
      },
    },
    switchNetworkTool: {
      ...switchNetworkTool,
      execute: (args: Parameters<typeof switchNetworkTool.execute>[0]) => {
        console.log('[Tool] switchNetworkTool:', JSON.stringify(args, null, 2))
        return switchNetworkTool.execute(args)
      },
    },
  }
}

const SYSTEM_PROMPT =
  `
**ShapeShift Crypto Assistant**

**Scope & Purpose:**
- Your expertise is cryptocurrency, blockchain, Web3, and DeFi
- Help with: crypto prices, trading, swaps, portfolios, transaction history, blockchain concepts, and market data
- Avoid: general programming/coding tasks, life advice, non-crypto topics
- When users ask off-topic questions, politely acknowledge and explain your focus is crypto-related assistance, then offer to help with cryptocurrency topics

**Core Rules:**
- Confirm network only if ambiguous (native tokens like SOL, ETH imply their network)
- Use precalculated humanReadableValue and usdValue from portfolio tool for display
- For ANY addition, subtraction, multiplication, or division: MUST use mathCalculator tool
- Never perform manual arithmetic - always use mathCalculator for calculations
- Never display caip10/caip19 IDs - show human names only
- Preserve exact decimal precision from tool outputs (never round/truncate)
- Use markdown formatting for all responses
- For mathematical formulas, use LaTeX: wrap block equations with $$...$$

**Tool Usage:**
- **getAssets**: Find assets by name/symbol, get prices and market data
- **getTransactionHistory**: Get recent transaction history for the connected wallet on a specific network
- **mathCalculator**: Use for all arithmetic operations to ensure precision
- **portfolio**: Get user balances with human-readable values and USD amounts (EVM chains and Solana only)
- **initiateSwap**: Execute swap with crypto token amounts (e.g., 1 ETH, 0.5 SOL)
- **initiateSwapUsd**: Execute swap with USD value amounts (e.g., $100 worth, $1.50 worth)
- **switchNetwork**: Switch the connected wallet to a different blockchain network

**Wallet Address Handling:**
- All tools automatically extract wallet addresses from connected wallet context
- You only need to specify networks and assets - never addresses

**Swap Workflow:**
1. Determine if user specified crypto token amount or USD value amount
2. Use initiateSwap for crypto token amounts (e.g., "1 SOL", "0.5 ETH", "100 FOX", "50 USDC")
3. Use initiateSwapUsd ONLY when user explicitly mentions USD value with $ sign or keywords like "worth", "dollars", "USD" (e.g., "$100 worth", "$1 of SOL", "50 dollars worth of ETH")
4. When user says a number + token symbol (e.g., "100 FOX"), this is a crypto token amount - use initiateSwap
5. After swap is initiated, respond with ONE brief sentence confirming the swap was started and directing them to follow the steps above (do NOT provide detailed swap summary, rate, fees, or other details)

**Network Resolution for Swaps:**
- One network specified → Same-chain swap (both assets use that network)
- Two different networks specified → Cross-chain swap
- Native tokens (SOL, ETH, AVAX, MATIC, BNB, OP, ARB) count as specifying their network
- No network + no native token → Ask user which network

Examples:
- "1 SOL to USDC" → same-chain solana
- "1 USDC on arbitrum to FOX" → same-chain arbitrum
- "1 ETH to USDC on arbitrum" → cross-chain (ethereum→arbitrum)

**Cross-Chain Terminology:**
- "Bridge" = Same asset cross-chain (ETH to Arbitrum = ETH→ETH, not ETH→ARB token)
- Native L2 tokens (ARB, OP, etc.) are distinct from bridged assets
- Ask for clarification if ambiguous between native token vs bridged asset

**Error Handling:**
- Insufficient balance → Show exact shortage amount
- No rates available → "Route not supported or amount too small"

**Portfolio Rules:**
- Only check balances if user says "all my [token]" or asks balance first
- For specific amounts ("swap 10 USDC"), use exact amount without balance check
` + supportedChainsContext

export async function handleChatRequest(c: Context) {
  try {
    const body = await c.req.json()
    const { messages, evmAddress, solanaAddress } = body as {
      messages: unknown
      evmAddress?: string
      solanaAddress?: string
    }

    // Build wallet context from addresses
    const walletContext = buildWalletContext(evmAddress, solanaAddress)

    // Convert UIMessages to ModelMessages
    const modelMessages = convertToModelMessages(messages as Parameters<typeof convertToModelMessages>[0])

    const result = streamText({
      model: anthropic('claude-haiku-4-5'),
      messages: modelMessages,
      system: SYSTEM_PROMPT,
      temperature: 1.0,
      stopWhen: stepCountIs(5),
      tools: buildTools(walletContext),
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error('[Chat API] Error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
}
