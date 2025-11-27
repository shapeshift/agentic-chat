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
import { format, getUnixTime } from 'date-fns'
import type { Context } from 'hono'

import { supportedChainsContext } from '../context'
import { anthropic } from '../models'
import { getAccountTool } from '../tools/getAccount'
import { getAllowanceTool } from '../tools/getAllowance'
import { getAssetsTool } from '../tools/getAssets'
import { getCategoriesTool } from '../tools/getCategories'
import { getNewCoinsTool } from '../tools/getNewCoins'
import { getShapeShiftKnowledgeTool } from '../tools/getShapeShiftKnowledge'
import { getTopGainersLosersTool } from '../tools/getTopGainersLosers'
import { getTrendingPoolsTool } from '../tools/getTrendingPools'
import { getTrendingTokensTool } from '../tools/getTrendingTokens'
import { initiateSwapTool, initiateSwapUsdTool } from '../tools/initiateSwap'
import { mathCalculator } from '../tools/mathCalculator'
import { portfolioTool } from '../tools/portfolio'
import { receiveTool } from '../tools/receive'
import { sendTool } from '../tools/send'
import { switchNetworkTool } from '../tools/switchNetwork'
import { transactionHistoryTool } from '../tools/transactionHistory'
import type { WalletContext } from '../utils/walletContextSimple'

function wrapToolWithLogging<
  T extends { description: string; inputSchema: unknown; execute: (args: never) => unknown },
>(name: string, tool: T): T {
  return {
    ...tool,
    execute: (args: Parameters<T['execute']>[0]) => {
      console.log(`[Tool] ${name}:`, JSON.stringify(args, null, 2))
      return tool.execute(args)
    },
  } as T
}

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
    mathCalculatorTool: wrapToolWithLogging('mathCalculatorTool', mathCalculator),
    getAssetsTool: wrapToolWithLogging('getAssetsTool', getAssetsTool),
    getAccountTool: wrapToolWithLogging('getAccountTool', getAccountTool),
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
    transactionHistoryTool: {
      description: transactionHistoryTool.description,
      inputSchema: transactionHistoryTool.inputSchema,
      execute: async (args: Parameters<typeof transactionHistoryTool.execute>[0]) => {
        console.log('[Tool] transactionHistoryTool:', JSON.stringify(args, null, 2))
        return transactionHistoryTool.execute(args, walletContext)
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
    switchNetworkTool: wrapToolWithLogging('switchNetworkTool', switchNetworkTool),
    sendTool: {
      description: sendTool.description,
      inputSchema: sendTool.inputSchema,
      execute: async (args: Parameters<typeof sendTool.execute>[0]) => {
        console.log('[Tool] sendTool:', JSON.stringify(args, null, 2))
        return sendTool.execute(args, walletContext)
      },
    },
    receiveTool: {
      description: receiveTool.description,
      inputSchema: receiveTool.inputSchema,
      execute: async (args: Parameters<typeof receiveTool.execute>[0]) => {
        console.log('[Tool] receiveTool:', JSON.stringify(args, null, 2))
        return receiveTool.execute(args, walletContext)
      },
    },
    getShapeShiftKnowledgeTool: wrapToolWithLogging('getShapeShiftKnowledgeTool', getShapeShiftKnowledgeTool),
    getTrendingTokensTool: wrapToolWithLogging('getTrendingTokensTool', getTrendingTokensTool),
    getTopGainersLosersTool: wrapToolWithLogging('getTopGainersLosersTool', getTopGainersLosersTool),
    getTrendingPoolsTool: wrapToolWithLogging('getTrendingPoolsTool', getTrendingPoolsTool),
    getCategoriesTool: wrapToolWithLogging('getCategoriesTool', getCategoriesTool),
    getNewCoinsTool: wrapToolWithLogging('getNewCoinsTool', getNewCoinsTool),
  }
}

function buildConnectedWalletsPrompt(evmAddress?: string, solanaAddress?: string): string {
  if (!evmAddress && !solanaAddress) {
    return '**Connected Wallets:** None'
  }
  const parts: string[] = []
  if (evmAddress) parts.push(`EVM (${evmAddress.slice(0, 6)}...${evmAddress.slice(-4)})`)
  if (solanaAddress) parts.push(`Solana (${solanaAddress.slice(0, 4)}...${solanaAddress.slice(-4)})`)
  return `**Connected Wallets:** ${parts.join(', ')}`
}

function buildSystemPrompt(evmAddress?: string, solanaAddress?: string): string {
  return (
    `
${buildConnectedWalletsPrompt(evmAddress, solanaAddress)}

**ShapeShift Crypto Assistant**

**Current Date and Time:**
- Today's date: ${format(new Date(), 'yyyy-MM-dd')} (${format(new Date(), 'EEEE, MMMM d, yyyy')})
- Current Unix timestamp: ${getUnixTime(new Date())}

**Scope & Purpose:**
- Your expertise is cryptocurrency, blockchain, Web3, and DeFi
- Help with: crypto prices, trading, swaps, portfolios, transaction history, blockchain concepts, and market data
- Avoid: general programming/coding tasks, life advice, non-crypto topics
- When users ask off-topic questions, politely acknowledge and explain your focus is crypto-related assistance, then offer to help with cryptocurrency topics

**Core Rules:**
- Confirm network only if ambiguous (native tokens like SOL, ETH imply their network)
- Use precalculated cryptoAmount and usdAmount from portfolio tool for display
- For ANY addition, subtraction, multiplication, or division: MUST use mathCalculator tool
- Never perform manual arithmetic - always use mathCalculator for calculations
- Never display caip10/caip19 IDs - show human names only
- Preserve exact decimal precision from tool outputs (never round/truncate)
- Use markdown formatting for all responses
- For mathematical formulas, use LaTeX: wrap block equations with $$...$$

**Wallet Address Handling:**
- All tools automatically extract wallet addresses from connected wallet context
- You only need to specify networks and assets - never addresses

**Tool Categories:**
- **Market Data**: getAssets (prices/market data), getTrendingTokens, getTopGainersLosers, getNewCoins, getCategories, getTrendingPools
- **Portfolio**: portfolio (balances), transactionHistoryTool (history/analytics)
- **Actions**: initiateSwap/initiateSwapUsd (swaps), sendTool (transfers), receiveTool (addresses/QR)
- **Utilities**: switchNetwork (change chains), mathCalculator (arithmetic), getShapeShiftKnowledge (platform info)

**Tool UI Behavior:**
Many tools render UI cards. Each tool's description specifies what the card displays. Your role is to supplement cards with brief, natural responses - never repeat or list data already shown in the card.

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
- Timeout errors → Suggest narrowing the query (shorter date range, specific network, fewer filters)
- If a tool fails, explain what went wrong and suggest alternatives

**Portfolio Rules:**
- Portfolio tool fetches all connected networks by default - no need to call multiple times
- Only check balances if user says "all my [token]" or asks balance first
- For specific amounts ("swap 10 USDC"), use exact amount without balance check
` + supportedChainsContext
  )
}

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
      system: buildSystemPrompt(evmAddress, solanaAddress),
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
