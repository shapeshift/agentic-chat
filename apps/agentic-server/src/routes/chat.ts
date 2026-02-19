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
import { CHAIN_ID_TO_NETWORK } from '../lib/cow/types'
import { getModel, getProviderName } from '../models'
import { checkWalletCapabilitiesTool } from '../tools/checkWalletCapabilities'
import { lookupExternalAddressTool } from '../tools/getAccount'
import { getAllowanceTool } from '../tools/getAllowance'
import { getAssetPricesTool } from '../tools/getAssetPrices'
import { getAssetsTool } from '../tools/getAssets'
import { getCategoriesTool } from '../tools/getCategories'
import { getNewCoinsTool } from '../tools/getNewCoins'
import { getPriceFeedTokensTool } from '../tools/getPriceFeedTokens'
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
import { createStopLossTool, getStopLossOrdersTool, cancelStopLossTool } from '../tools/stopLoss'
import { switchNetworkTool } from '../tools/switchNetwork'
import { transactionHistoryTool } from '../tools/transactionHistory'
import { createTwapTool, getTwapOrdersTool, cancelTwapTool } from '../tools/twap'
import { vaultBalanceTool, vaultDepositTool, vaultWithdrawTool } from '../tools/vault'
import type { ActiveOrderSummary, SafeChainDeployment, WalletContext } from '../utils/walletContextSimple'

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
  hasExternalWallet?: boolean,
  safeAddress?: string,
  safeDeploymentState?: Record<number, SafeChainDeployment>,
  registryOrders?: ActiveOrderSummary[]
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

  return {
    connectedWallets,
    hasEmbeddedWallet,
    hasExternalWallet,
    safeAddress,
    safeDeploymentState,
    registryOrders,
  }
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
    getPriceFeedTokensTool: wrapTool('getPriceFeedTokensTool', getPriceFeedTokensTool),
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
    createStopLossTool: wrapTool('createStopLossTool', createStopLossTool, walletContext),
    getStopLossOrdersTool: wrapTool('getStopLossOrdersTool', getStopLossOrdersTool, walletContext),
    cancelStopLossTool: wrapTool('cancelStopLossTool', cancelStopLossTool, walletContext),
    createTwapTool: wrapTool('createTwapTool', createTwapTool, walletContext),
    getTwapOrdersTool: wrapTool('getTwapOrdersTool', getTwapOrdersTool, walletContext),
    cancelTwapTool: wrapTool('cancelTwapTool', cancelTwapTool, walletContext),
    vaultBalanceTool: wrapTool('vaultBalanceTool', vaultBalanceTool, walletContext),
    vaultDepositTool: wrapTool('vaultDepositTool', vaultDepositTool, walletContext),
    vaultWithdrawTool: wrapTool('vaultWithdrawTool', vaultWithdrawTool, walletContext),

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

function buildSafeStatusPrompt(safeDeploymentState?: Record<number, SafeChainDeployment>): string {
  if (!safeDeploymentState || Object.keys(safeDeploymentState).length === 0) {
    return '- No Safe smart account configured yet'
  }

  const lines: string[] = []
  const readyChains: string[] = []
  const deployedNotReadyChains: string[] = []
  const allCoWChains = [1, 100, 42161] // ethereum, gnosis, arbitrum
  const notDeployedChains: string[] = []

  for (const chainId of allCoWChains) {
    const state = safeDeploymentState[chainId]
    const networkName = CHAIN_ID_TO_NETWORK[chainId] ?? `chain ${chainId}`
    if (state?.isDeployed && state.modulesEnabled && state.domainVerifierSet) {
      const shortAddr = `${state.safeAddress.slice(0, 6)}...${state.safeAddress.slice(-4)}`
      readyChains.push(`${networkName} (${shortAddr})`)
    } else if (state?.isDeployed) {
      deployedNotReadyChains.push(networkName)
    } else {
      notDeployedChains.push(networkName)
    }
  }

  if (readyChains.length > 0) lines.push(`- Safe ready on: ${readyChains.join(', ')}`)
  if (deployedNotReadyChains.length > 0)
    lines.push(`- Safe deployed but NOT ready (modules/verifier missing) on: ${deployedNotReadyChains.join(', ')}`)
  if (notDeployedChains.length > 0) lines.push(`- Safe NOT deployed on: ${notDeployedChains.join(', ')}`)

  return lines.join('\n')
}

function isSafeReadyOnAnyChain(safeDeploymentState?: Record<number, SafeChainDeployment>): boolean {
  if (!safeDeploymentState) return false
  return Object.values(safeDeploymentState).some(s => s.isDeployed && s.modulesEnabled && s.domainVerifierSet)
}

function buildSystemPrompt(
  evmAddress?: string,
  solanaAddress?: string,
  approvedChainIds?: string[],
  safeDeploymentState?: Record<number, SafeChainDeployment>
): string {
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
- NEVER generate, construct, or guess URLs. Only share URLs that are explicitly returned in tool results (e.g., cowTrackingUrl). If no URL was returned by a tool, do not provide one.
- Never mention internal tool names in responses (e.g., "vaultBalanceTool", "getAssetsTool") - describe capabilities in natural language instead (e.g., "check your vault balance", "look up market data")

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
- **Actions**: initiateSwap/initiateSwapUsd (swaps), sendTool (transfers), receiveTool (addresses/QR), createLimitOrder/getLimitOrders/cancelLimitOrder (limit orders), createStopLoss/getStopLossOrders/cancelStopLoss (stop-loss orders), createTwap/getTwapOrders/cancelTwap (TWAP/DCA orders), vaultDeposit/vaultWithdraw/vaultBalance (Safe vault management)
- **Utilities**: switchNetwork (change chains), mathCalculator (arithmetic), getShapeShiftKnowledge (platform info), getPriceFeedTokens (check which tokens support stop-loss price feeds)

**Tool UI Behavior:**
Many tools render UI cards. Each tool's description specifies what the card displays.
AFTER a tool with a UI card executes successfully, respond with one brief, natural sentence (e.g., "Here's what I found" or "Check out the details above"). Never list or repeat data already shown in the card. Only elaborate if the user asks about something not shown in the card.
For tools marked "No UI card", format and present the data directly in your response.

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

**Stop-Loss Orders (ComposableCoW + Safe):**
- Use createStopLoss when user wants to protect against price drops (e.g., "set stop-loss on ETH at $3000")
- Requires a Safe smart account (deployed automatically on first use — works with any connected wallet)
- Orders are registered on-chain via ComposableCoW — CoW's watchtower network monitors and executes them
- Trigger price must be BELOW current market price
- Only tokens with Chainlink price feed oracles are supported
- Before creating a stop-loss, if unsure whether a token has oracle support, call getPriceFeedTokens first
- 2% slippage buffer is applied automatically
- Supports: Ethereum, Gnosis, Arbitrum (same-chain only)
- Native tokens (ETH) must be wrapped (WETH) to use as sell asset
- Use getStopLossOrders to check existing stop-loss orders (queries CoW API)
- Use cancelStopLoss to cancel active orders (requires on-chain transaction via Safe)
- If user doesn't have a Safe ready, guide them through setup (checkWalletCapabilities)

**TWAP/DCA Orders (ComposableCoW + Safe):**
- Use createTwap when user wants to split a large trade over time or DCA into a position
- "TWAP" = Time-Weighted Average Price (hours), "DCA" = Dollar Cost Averaging (days/weeks) — same tool
- Examples: "buy $1000 of ETH over 24 hours", "DCA $200 into BTC every day for a week"
- Requires a Safe smart account (deployed automatically on first use)
- Orders are time-based (no price oracle needed) — each sub-order executes at market price
- CoW's watchtower generates and executes sub-orders at each interval
- CoW solver network provides MEV protection on each sub-order
- Supports: Ethereum, Gnosis, Arbitrum (same-chain only)
- Native tokens (ETH) must be wrapped (WETH) to use as sell asset
- Use getTwapOrders to check existing TWAP/DCA orders
- Use cancelTwap to cancel active orders (requires on-chain transaction via Safe)

**Safe Wallet Status:**
${buildSafeStatusPrompt(safeDeploymentState)}
${!isSafeReadyOnAnyChain(safeDeploymentState) ? '- IMPORTANT: Safe-dependent tools (createStopLoss, cancelStopLoss, createTwap, cancelTwap, vaultDeposit, vaultWithdraw) will fail without a ready Safe. Guide the user to set up their Safe first using checkWalletCapabilities.' : '- Safe is ready for automation tools (stop-loss, TWAP/DCA, vault operations)'}

**Safe & Automation:**
- Automation features (stop-loss, TWAP, DCA) require a Safe smart account
- Safe is a 1-of-1 smart account owned by the connected wallet (any EOA — MetaMask, Rabby, embedded, etc.)
- Safe is deployed lazily on first automation request
- When users ask about automated features, call checkWalletCapabilitiesTool to check readiness
- Wallet routing: regular swaps/sends → EOA wallet, automation → Safe smart account
- Users can also create embedded wallets (email/social login) — self-custodial MPC wallets with social recovery

**Vault Management (Safe Deposits & Withdrawals):**
- Tokens must be deposited into the Safe vault before automated orders can execute
- Stop-loss order creation automatically includes a deposit step if the Safe has insufficient balance
- Use vaultDeposit to manually transfer tokens from EOA → Safe vault
- Use vaultWithdraw to transfer tokens from Safe vault → EOA (requires Safe transaction signing)
- Use vaultBalance to check what tokens are currently in the Safe vault
- Deposits are standard ERC20 transfers (signed by EOA); withdrawals are Safe transactions (signed as Safe owner)

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
    const {
      messages,
      evmAddress,
      solanaAddress,
      approvedChainIds,
      hasEmbeddedWallet,
      hasExternalWallet,
      safeAddress,
      safeDeploymentState,
      registryOrders,
    } = body as {
      messages: unknown
      evmAddress?: string
      solanaAddress?: string
      approvedChainIds?: string[]
      hasEmbeddedWallet?: boolean
      hasExternalWallet?: boolean
      safeAddress?: string
      safeDeploymentState?: Record<number, SafeChainDeployment>
      registryOrders?: ActiveOrderSummary[]
    }

    // Build wallet context from addresses (filtered by approved chains if provided)
    const walletContext = buildWalletContext(
      evmAddress,
      solanaAddress,
      approvedChainIds,
      hasEmbeddedWallet,
      hasExternalWallet,
      safeAddress,
      safeDeploymentState,
      registryOrders
    )

    // Convert UIMessages to ModelMessages
    const modelMessages = convertToModelMessages(messages as Parameters<typeof convertToModelMessages>[0])

    const result = streamText({
      model: getModel(),
      messages: modelMessages,
      system: buildSystemPrompt(evmAddress, solanaAddress, approvedChainIds, safeDeploymentState),
      temperature: 0.6,
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
