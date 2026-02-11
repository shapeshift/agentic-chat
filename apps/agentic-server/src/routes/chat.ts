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
import { getModel, getProviderName } from '../models'
import { checkWalletCapabilitiesTool } from '../tools/checkWalletCapabilities'
import { lookupExternalAddressTool } from '../tools/getAccount'
import { getAllowanceTool } from '../tools/getAllowance'
import { getAssetPricesTool } from '../tools/getAssetPrices'
import { getAssetsTool } from '../tools/getAssets'
import { getCategoriesTool } from '../tools/getCategories'
import { getNewCoinsTool } from '../tools/getNewCoins'
import { getShapeShiftKnowledgeTool } from '../tools/getShapeShiftKnowledge'
import { getTopGainersLosersTool } from '../tools/getTopGainersLosers'
import { getTrendingPoolsTool } from '../tools/getTrendingPools'
import { getTrendingTokensTool } from '../tools/getTrendingTokens'
import { initiateSwapTool, initiateSwapUsdTool } from '../tools/initiateSwap'
import { createLimitOrderTool, getLimitOrdersTool, cancelLimitOrderTool } from '../tools/limitOrder'
import { mathCalculator } from '../tools/mathCalculator'
import { portfolioTool } from '../tools/portfolio'
import { receiveTool } from '../tools/receive'
import { sendTool } from '../tools/send'
import { switchNetworkTool } from '../tools/switchNetwork'
import { transactionHistoryTool } from '../tools/transactionHistory'
import type { WalletContext } from '../utils/walletContextSimple'

const allEvmChainIds = [
  ethChainId,
  arbitrumChainId,
  optimismChainId,
  baseChainId,
  polygonChainId,
  avalancheChainId,
  bscChainId,
  gnosisChainId,
]

const allSupportedChainIds = [...allEvmChainIds, solanaChainId]

function wrapTool<TSchema, TExecute extends (args: never, walletContext?: WalletContext) => unknown>(
  name: string,
  tool: { description: string; inputSchema: TSchema; execute: TExecute },
  walletContext?: WalletContext
) {
  return {
    description: tool.description,
    inputSchema: tool.inputSchema,
    execute: (args: Parameters<TExecute>[0]) => {
      console.log(`[Tool] ${name}:`, JSON.stringify(args, null, 2))
      return tool.execute(args, walletContext)
    },
  }
}

function buildWalletContext(
  evmAddress?: string,
  solanaAddress?: string,
  approvedChainIds?: string[],
  hasEmbeddedWallet?: boolean,
  hasExternalWallet?: boolean
): WalletContext {
  const connectedWallets: Record<string, { address: string }> = {}

  // Add EVM wallet - same address works across all EVM chains
  if (evmAddress) {
    // If approvedChainIds provided (WalletConnect), filter to only approved chains
    // Otherwise fall back to all chains (for injected wallets like MetaMask)
    const chainsToRegister =
      approvedChainIds && approvedChainIds.length > 0
        ? allEvmChainIds.filter(chainId => approvedChainIds.includes(chainId))
        : allEvmChainIds

    chainsToRegister.forEach(chainId => {
      connectedWallets[chainId] = { address: evmAddress }
    })
  }

  // Add Solana wallet (only if approved or no filter provided)
  if (solanaAddress) {
    const solanaApproved =
      !approvedChainIds || approvedChainIds.length === 0 || approvedChainIds.includes(solanaChainId)
    if (solanaApproved) {
      connectedWallets[solanaChainId] = { address: solanaAddress }
    }
  }

  return { connectedWallets, hasEmbeddedWallet, hasExternalWallet }
}

function buildTools(walletContext: WalletContext) {
  return {
    // Tools without wallet context
    mathCalculatorTool: wrapTool('mathCalculatorTool', mathCalculator),
    getAssetsTool: wrapTool('getAssetsTool', getAssetsTool),
    getAssetPricesTool: wrapTool('getAssetPricesTool', getAssetPricesTool),
    lookupExternalAddress: wrapTool('lookupExternalAddress', lookupExternalAddressTool),
    switchNetworkTool: wrapTool('switchNetworkTool', switchNetworkTool),
    checkWalletCapabilitiesTool: wrapTool('checkWalletCapabilitiesTool', checkWalletCapabilitiesTool, walletContext),
    getShapeShiftKnowledgeTool: wrapTool('getShapeShiftKnowledgeTool', getShapeShiftKnowledgeTool),
    getTrendingTokensTool: wrapTool('getTrendingTokensTool', getTrendingTokensTool),
    getTopGainersLosersTool: wrapTool('getTopGainersLosersTool', getTopGainersLosersTool),
    getTrendingPoolsTool: wrapTool('getTrendingPoolsTool', getTrendingPoolsTool),
    getCategoriesTool: wrapTool('getCategoriesTool', getCategoriesTool),
    getNewCoinsTool: wrapTool('getNewCoinsTool', getNewCoinsTool),

    // Tools with wallet context
    transactionHistoryTool: wrapTool('transactionHistoryTool', transactionHistoryTool, walletContext),
    portfolioTool: wrapTool('portfolioTool', portfolioTool, walletContext),
    initiateSwapTool: wrapTool('initiateSwapTool', initiateSwapTool, walletContext),
    initiateSwapUsdTool: wrapTool('initiateSwapUsdTool', initiateSwapUsdTool, walletContext),
    sendTool: wrapTool('sendTool', sendTool, walletContext),
    receiveTool: wrapTool('receiveTool', receiveTool, walletContext),
    createLimitOrderTool: wrapTool('createLimitOrderTool', createLimitOrderTool, walletContext),
    getLimitOrdersTool: wrapTool('getLimitOrdersTool', getLimitOrdersTool, walletContext),
    cancelLimitOrderTool: wrapTool('cancelLimitOrderTool', cancelLimitOrderTool, walletContext),

    // Special case - has custom address resolution logic
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
  }
}

const chainIdToName: Record<string, string> = {
  [ethChainId]: 'Ethereum',
  [arbitrumChainId]: 'Arbitrum',
  [optimismChainId]: 'Optimism',
  [baseChainId]: 'Base',
  [polygonChainId]: 'Polygon',
  [avalancheChainId]: 'Avalanche',
  [bscChainId]: 'BNB Chain',
  [gnosisChainId]: 'Gnosis',
  [solanaChainId]: 'Solana',
}

function buildConnectedWalletsPrompt(evmAddress?: string, solanaAddress?: string, approvedChainIds?: string[]): string {
  if (!evmAddress && !solanaAddress) {
    return '**Connected Wallets:** None'
  }

  const parts: string[] = []
  if (evmAddress) parts.push(`EVM (${evmAddress.slice(0, 6)}...${evmAddress.slice(-4)})`)
  if (solanaAddress) parts.push(`Solana (${solanaAddress.slice(0, 4)}...${solanaAddress.slice(-4)})`)

  let prompt = `**Connected Wallets:** ${parts.join(', ')}`

  // If we have approved chain IDs (WalletConnect), show which networks are connected
  if (approvedChainIds && approvedChainIds.length > 0) {
    const connectedNames = approvedChainIds
      .map(id => chainIdToName[id])
      .filter(Boolean)
      .sort()

    const notConnectedIds = allSupportedChainIds.filter(id => !approvedChainIds.includes(id))
    const notConnectedNames = notConnectedIds
      .map(id => chainIdToName[id])
      .filter(Boolean)
      .sort()

    if (connectedNames.length > 0) {
      prompt += `\n**Connected Networks:** ${connectedNames.join(', ')}`
    }
    if (notConnectedNames.length > 0) {
      prompt += `\n**Not Connected by Wallet (user must add these networks in their wallet to use them):** ${notConnectedNames.join(', ')}`
    }
  }

  return prompt
}

function buildSystemPrompt(evmAddress?: string, solanaAddress?: string, approvedChainIds?: string[]): string {
  return (
    `
${buildConnectedWalletsPrompt(evmAddress, solanaAddress, approvedChainIds)}

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
- Never display caip10/caip19 IDs - show human names only
- Preserve exact decimal precision from tool outputs (never round/truncate)
- Use markdown formatting for all responses - never use HTML tags like <br> (they render as literal text)
- For mathematical formulas, use LaTeX: wrap block equations with $$...$$

**CRITICAL - Math & Calculations:**
- NEVER attempt mental arithmetic - you WILL make mistakes
- Portfolio totals are pre-calculated in the response - use totals.overall and totals.byNetwork directly
- For ANY other calculation (currency conversions, percentages, sums): MUST use mathCalculator tool
- If you need to compute something not already provided, ALWAYS use mathCalculator

**Wallet Address Handling:**
- All tools automatically extract wallet addresses from connected wallet context
- You only need to specify networks and assets - never addresses

**Tool Categories:**
- **Market Data**:
  - getAssetPrices: Quick price lookups (no UI card) - use when user asks "what's the price of X?" or you need prices for calculations
  - getAssets: Detailed market data with UI card - use when user wants comprehensive info (volume, market cap, sentiment, etc.)
  - getTrendingTokens, getTopGainersLosers, getNewCoins, getCategories, getTrendingPools
- **Portfolio**: portfolio (balances), transactionHistoryTool (history/analytics)
- **Actions**: initiateSwap/initiateSwapUsd (swaps), sendTool (transfers), receiveTool (addresses/QR), createLimitOrder/getLimitOrders/cancelLimitOrder (limit orders)
- **Utilities**: switchNetwork (change chains), mathCalculator (arithmetic), getShapeShiftKnowledge (platform info)

**Tool UI Behavior:**
Many tools render UI cards. Each tool's description specifies what the card displays. Your role is to supplement cards with brief, natural responses - never repeat or list data already shown in the card.

**Transaction History Tool Optimization:**
When using transactionHistoryTool, always set the renderTransactions parameter based on user intent:
- "last transaction" / "most recent tx" → renderTransactions: 1
- "last 3 transactions" / "recent txs" → renderTransactions: 3-5
- "all transactions" / large queries → renderTransactions: 10-20 (reasonable limit)
- Aggregation queries (counts, sums) → renderTransactions: false (no UI cards)
This prevents UI crashes from rendering hundreds of transaction cards.

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

**Limit Orders:**
- Use createLimitOrder when user wants to trade at a specific price (e.g., "buy ETH when it hits $3000")
- Limit orders are gasless (off-chain EIP-712 signature via CoW Protocol)
- Currently supports: Ethereum, Gnosis, Arbitrum (same-chain only, no cross-chain limit orders)
- Use getLimitOrders to check user's existing orders
- Use cancelLimitOrder to cancel pending orders
- Orders auto-execute when market price reaches limit

**Embedded Wallets & Automation:**
- Users can connect external wallets (MetaMask, etc.) OR create an embedded wallet (email/social login)
- Embedded wallets are self-custodial MPC wallets - no seed phrase, social recovery available
- When users ask about automated features (TWAP, DCA, stop-loss, scheduled trades), call checkWalletCapabilitiesTool
- If user has only external wallet and wants automation, explain embedded wallet benefits conversationally
- Never pressure users to switch - external wallets work for all non-automation features

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
    const { messages, evmAddress, solanaAddress, approvedChainIds, hasEmbeddedWallet, hasExternalWallet } = body as {
      messages: unknown
      evmAddress?: string
      solanaAddress?: string
      approvedChainIds?: string[]
      hasEmbeddedWallet?: boolean
      hasExternalWallet?: boolean
    }

    // Build wallet context from addresses (filtered by approved chains if provided)
    const walletContext = buildWalletContext(
      evmAddress,
      solanaAddress,
      approvedChainIds,
      hasEmbeddedWallet,
      hasExternalWallet
    )

    // Convert UIMessages to ModelMessages
    const modelMessages = convertToModelMessages(messages as Parameters<typeof convertToModelMessages>[0])

    const result = streamText({
      model: getModel(),
      messages: modelMessages,
      system: buildSystemPrompt(evmAddress, solanaAddress, approvedChainIds),
      temperature: 1.0,
      stopWhen: stepCountIs(5),
      tools: buildTools(walletContext),
      // Venice-specific parameters to disable reasoning for faster responses
      ...(getProviderName() === 'venice' && {
        providerOptions: {
          venice: {
            venice_parameters: {
              disable_thinking: true,
              include_venice_system_prompt: false,
            },
          },
        },
      }),
      onError: ({ error }) => {
        console.error('[Stream Error]', {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : 'Unknown',
          cause: error instanceof Error ? error.cause : undefined,
        })
      },
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    const errorDetails = {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
    }
    console.error('[Chat API] Request Error:', errorDetails)
    return c.json({ error: 'Internal server error', details: errorDetails.message }, 500)
  }
}
