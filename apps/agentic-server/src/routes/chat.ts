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
import { z } from 'zod'

import { CHAIN_ID_TO_NETWORK } from '../lib/cow/types'
import { getModel, getProviderName } from '../models'
import { checkWalletCapabilitiesTool } from '../tools/checkWalletCapabilities'
import { lookupExternalAddressTool } from '../tools/getAccount'
import { getAllowanceTool } from '../tools/getAllowance'
import { getAssetPricesTool } from '../tools/getAssetPrices'
import { getAssetsTool } from '../tools/getAssets'
import { getCategoriesTool } from '../tools/getCategories'
import { getHistoricalPricesTool } from '../tools/getHistoricalPrices'
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
import { vaultBalanceTool, vaultDepositTool, vaultWithdrawTool, vaultWithdrawAllTool } from '../tools/vault'
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

function wrapTools(
  tools: Record<
    string,
    { description: string; inputSchema: unknown; execute: (args: never, walletContext?: WalletContext) => unknown }
  >,
  walletContext?: WalletContext
) {
  return Object.fromEntries(Object.entries(tools).map(([name, tool]) => [name, wrapTool(name, tool, walletContext)]))
}

function buildWalletContext(
  evmAddress?: string,
  solanaAddress?: string,
  approvedChainIds?: string[],
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
    safeAddress,
    safeDeploymentState,
    registryOrders,
  }
}

function buildTools(walletContext: WalletContext) {
  return {
    ...wrapTools({
      mathCalculatorTool: mathCalculator,
      getAssetsTool,
      getAssetPricesTool,
      getHistoricalPricesTool,
      lookupExternalAddress: lookupExternalAddressTool,
      switchNetworkTool,
      getShapeShiftKnowledgeTool,
      getPriceFeedTokensTool,
      getTrendingTokensTool,
      getTopGainersLosersTool,
      getTrendingPoolsTool,
      getCategoriesTool,
      getNewCoinsTool,
    }),
    ...wrapTools(
      {
        checkWalletCapabilitiesTool,
        transactionHistoryTool,
        portfolioTool,
        initiateSwapTool,
        initiateSwapUsdTool,
        sendTool,
        receiveTool,
        createLimitOrderTool,
        getLimitOrdersTool,
        cancelLimitOrderTool,
        createStopLossTool,
        getStopLossOrdersTool,
        cancelStopLossTool,
        createTwapTool,
        getTwapOrdersTool,
        cancelTwapTool,
        vaultBalanceTool,
        vaultDepositTool,
        vaultWithdrawTool,
        vaultWithdrawAllTool,
      },
      walletContext
    ),
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
  return `
${buildConnectedWalletsPrompt(evmAddress, solanaAddress, approvedChainIds)}

<identity>
You are ShapeShift's crypto assistant. You help users with cryptocurrency prices, trading, swaps, portfolios, transaction history, blockchain concepts, and DeFi.

When users ask about non-crypto topics, acknowledge their question briefly, then offer to help with cryptocurrency topics instead.
</identity>

<context>
**Date:** ${format(new Date(), 'yyyy-MM-dd')} (${format(new Date(), 'EEEE, MMMM d, yyyy')})
**Unix Timestamp:** ${getUnixTime(new Date())}

**Safe Wallet Status:**
${buildSafeStatusPrompt(safeDeploymentState)}
${!isSafeReadyOnAnyChain(safeDeploymentState) ? '- No Safe deployed yet. Automation tools (stop-loss, TWAP/DCA, vault) will deploy one automatically on first use.' : '- Safe is ready for automation tools (stop-loss, TWAP/DCA, vault operations)'}
</context>

<response-rules>
- Use markdown formatting (no HTML tags). Use LaTeX ($$...$$) for math equations.
- Preserve exact decimal precision from tool outputs — never round or truncate.
- Show human-readable names only — never display CAIP-10/CAIP-19 identifiers.
- Refer to capabilities in natural language ("check your vault balance"), not by internal tool names ("vaultBalanceTool").
- Keep responses concise: 1-3 sentences for confirmations, short paragraphs for explanations.
- Only share URLs explicitly returned by tool results. If no URL was returned, do not provide one.
- All tools automatically resolve wallet addresses from the connected wallet — specify networks and assets only, never addresses.
- If a tool fails, explain what went wrong and suggest alternatives.
- Insufficient balance errors: show the exact shortage amount.
- No swap rates found: respond "Route not supported or amount too small."
- Timeout or large-result errors: suggest the user narrow the query (shorter date range, specific network, fewer filters).
- For any arithmetic — currency conversions, percentages, sums — use mathCalculator. Portfolio totals are pre-calculated; use totals.overall and totals.byNetwork directly.
</response-rules>

<tool-routing>
Select the single tool matching the user's intent (these names are internal — never mention them to the user):

| Intent | Tool |
|---|---|
| Quick price check (no UI card) | getAssetPrices |
| Historical prices / price at past date / price growth over time | getHistoricalPrices |
| Detailed market data (UI card) | getAssets |
| Trending/gainers/new coins | getTrendingTokens, getTopGainersLosers, getNewCoins |
| Trending pools | getTrendingPools |
| Categories | getCategories |
| Token price feed support check | getPriceFeedTokens |
| Portfolio balances | portfolio |
| Transaction history | transactionHistory |
| Swap (token amount: "1 SOL", "100 FOX") | initiateSwap |
| Swap (USD amount: "$100 worth", "50 dollars") | initiateSwapUsd |
| Trade at specific price | createLimitOrder |
| Protect against price drop | createStopLoss |
| Split trade over time / DCA | createTwap |
| View existing orders | getLimitOrders, getStopLossOrders, getTwapOrders |
| Cancel order | cancelLimitOrder, cancelStopLoss, cancelTwap |
| Send tokens | send |
| Receive address / QR | receive |
| Vault deposit/withdraw/balance | vaultDeposit, vaultWithdraw, vaultWithdrawAll, vaultBalance |
| Check Safe readiness | checkWalletCapabilities |
| Switch network | switchNetwork |
| Arithmetic | mathCalculator |
| ShapeShift platform info | getShapeShiftKnowledge |
| Resolve ENS/address | lookupExternalAddress |

Each trade type (swap, limit, stop-loss, TWAP) is an independent workflow — call only the one matching the user's intent.
</tool-routing>

<tool-ui>
Many tools render UI cards (as noted in their descriptions). After a tool with a UI card executes successfully, respond with one brief natural sentence (e.g., "Here's what I found"). Do not repeat data shown in the card. Only elaborate if the user asks about something not displayed.

For tools without UI cards, format and present data directly in your response.

**Transaction history optimization:** Set renderTransactions based on user intent:
- "last transaction" → 1
- "recent txs" → 3-5
- "all transactions" → 10-20
- Aggregation queries (counts, sums) → false
- Type-specific queries ("last swap", "my sends") → set types filter (e.g. ["swap"]) so rendered cards match your description
</tool-ui>

<portfolio-rules>
- Portfolio fetches all connected networks in one call — no need to call multiple times.
- Only check balances when user says "all my [token]" or explicitly asks for a balance.
- For specific amounts ("swap 10 USDC"), use the exact amount without a balance check first.
</portfolio-rules>

<usd-conversion>
When a user specifies a dollar amount ($X, "X dollars", "X USD worth"):
- **Swaps:** Use initiateSwapUsd (handles conversion automatically).
- **Limit orders, stop-loss, TWAP:** You must convert manually:
  1. Call getAssetPrices for the token's USD price
  2. Call mathCalculator: tokenAmount = usdAmount / pricePerToken
  3. Pass the token amount to the trade tool
  4. Show both USD and token amounts in your confirmation

<example>
"$2.50 of WBTC" when WBTC = $66,000 → tokenAmount = 2.50 / 66000 = 0.0000379 WBTC.
Passing 2.5 as the amount would mean 2.5 WBTC (~$165,000) — a 66,000x error.
</example>

This is the highest-severity mistake in the system — always convert USD to token units for non-swap trades.

If unsure whether a number is USD or tokens, ask the user.
</usd-conversion>

<swap-rules>
**Distinguishing token amounts from USD amounts:**
- Number + token symbol ("100 FOX", "0.5 ETH") = crypto amount → initiateSwap
- Dollar sign, "dollars", "USD", "worth" ("$100 worth", "$1 of SOL") = USD amount → initiateSwapUsd
- Bare number without symbol or dollar sign ("100 of ETH", "500 on WBTC") is ambiguous — ask the user whether they mean USD or token units.

**Network resolution:**
- Native tokens (SOL, ETH, AVAX, MATIC, BNB) imply their network — no need to ask.
- One network specified → same-chain swap.
- Two networks specified → cross-chain swap.
- No network and no native token → ask the user.

<example>
- "1 SOL to USDC" → same-chain Solana
- "1 USDC on Arbitrum to FOX" → same-chain Arbitrum
- "1 ETH to USDC on Arbitrum" → cross-chain (Ethereum → Arbitrum)
</example>

**"Bridge"** means same asset cross-chain (ETH to Arbitrum = ETH→ETH, not ETH→ARB token). Ask for clarification if ambiguous.

After initiating a swap, respond with one brief confirmation sentence. Do not provide rate, fee, or summary details.
</swap-rules>

<cow-protocol>
Limit orders, stop-loss, and TWAP/DCA all use CoW Protocol.

**Shared rules (apply to all three):**
- Supported chains: see <network-capabilities> (Ethereum, Gnosis, Arbitrum — same-chain only).
- Sell-side native tokens (ETH) must be wrapped to WETH first.
- Orders are gasless (off-chain EIP-712 signatures).
- Stop-loss and TWAP/DCA require a Safe smart account. Limit orders do not.

**Limit orders:** Execute when market price reaches the target.

**Stop-loss orders:**
- Trigger price must be below current market price.
- Only tokens with Chainlink price feed oracles are supported — call getPriceFeedTokens to verify.
- 2% slippage buffer applied automatically.

**TWAP/DCA orders:**
- TWAP = split over hours; DCA = split over days/weeks. Same tool (createTwap).
- Time-based execution (no price oracle needed) — each sub-order executes at market price.
- If the tool output includes warnings, always surface them to the user and suggest increasing the total amount or reducing intervals.
- Per-part amounts below ~$2 (L2s) or ~$10 (Ethereum) may not be filled by solvers.
- Status "failed" means the TWAP expired with zero parts filled (solvers ignored all sub-orders). Advise increasing total amount, reducing number of intervals, or choosing a more liquid token pair.
- Status "partiallyFilled" means some (but not all) sub-orders were filled before the TWAP window ended.
- Status "expired" means the TWAP window ended but fill state couldn't be determined (e.g. API unavailable or legacy order without part count data). Do not assume failure — suggest the user check back later.
</cow-protocol>

<safe-account>
**Vault management:**
- Tokens must be deposited into the Safe vault before automated orders can execute.
- Stop-loss creation automatically includes a deposit step if the Safe has insufficient balance.
- Fulfilled orders leave purchased tokens in the vault until the user withdraws.
- vaultDeposit: EOA to Safe. vaultWithdraw: Safe to EOA (specific tokens). vaultWithdrawAll: Safe to EOA (everything, one tx per chain).
- When a user requests a vault withdrawal and has active TWAP/stop-loss orders, ask whether they want to withdraw only excess funds (default) or everything (which may break active orders).
</safe-account>

<network-capabilities>
**Supported Networks by Feature:**

| Feature | Networks |
|---|---|
| Prices & market data | All 18: ethereum, arbitrum, optimism, base, polygon, avalanche, bsc, gnosis, solana, sui, bitcoin, litecoin, dogecoin, bitcoincash, cosmos, thorchain, tron, cardano |
| Portfolio balances | EVM chains + Solana |
| Swaps | EVM chains + Solana (EVM↔EVM, Sol↔Sol, EVM↔Sol) |
| Limit/Stop-loss/TWAP | Ethereum, Gnosis, Arbitrum (same-chain only) |

Cross-chain swaps between Solana and any EVM chain are supported — always attempt the swap.
Unsupported swap routes: bitcoin, litecoin, dogecoin, bitcoincash, cosmos, thorchain, tron, cardano, sui.
When a route is unavailable, recommend https://app.shapeshift.com/ for additional chain support.
</network-capabilities>
`
}

const chatRequestSchema = z.object({
  messages: z.array(z.record(z.string(), z.unknown())),
  evmAddress: z.string().optional(),
  solanaAddress: z.string().optional(),
  approvedChainIds: z.array(z.string()).optional(),
  safeAddress: z.string().optional(),
  safeDeploymentState: z
    .record(
      z.string(),
      z.object({
        isDeployed: z.boolean(),
        modulesEnabled: z.boolean(),
        domainVerifierSet: z.boolean(),
        safeAddress: z.string(),
      })
    )
    .optional(),
  registryOrders: z
    .array(
      z.object({
        orderHash: z.string(),
        chainId: z.number(),
        sellTokenAddress: z.string(),
        sellTokenSymbol: z.string(),
        sellAmountBaseUnit: z.string(),
        sellAmountHuman: z.string(),
        buyTokenAddress: z.string(),
        buyTokenSymbol: z.string(),
        buyAmountHuman: z.string(),
        strikePrice: z.string(),
        validTo: z.number(),
        submitTxHash: z.string(),
        createdAt: z.number(),
        network: z.string(),
        status: z.enum(['open', 'triggered', 'fulfilled', 'cancelled', 'expired', 'failed', 'partiallyFilled']),
        orderType: z.enum(['stopLoss', 'twap']),
        numParts: z.number().optional(),
      })
    )
    .optional(),
})

export async function handleChatRequest(c: Context) {
  try {
    const body = await c.req.json()
    const parsed = chatRequestSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ error: 'Invalid request body', details: parsed.error.issues }, 400)
    }

    const { messages, evmAddress, solanaAddress, approvedChainIds, safeAddress, safeDeploymentState, registryOrders } =
      parsed.data

    // Build wallet context from addresses (filtered by approved chains if provided)
    const walletContext = buildWalletContext(
      evmAddress,
      solanaAddress,
      approvedChainIds,
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
