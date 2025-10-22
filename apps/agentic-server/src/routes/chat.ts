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
import { openai } from '../models'
import { getAccountTool } from '../tools/getAccount'
import { getAllowanceTool } from '../tools/getAllowance'
import { getAssetsTool } from '../tools/getAssets'
import { getTransactionHistoryTool } from '../tools/getTransactionHistory'
import { initiateSwapTool } from '../tools/initiateSwap'
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

const SYSTEM_PROMPT =
  `
**ShapeShift Crypto Assistant**

**Scope & Purpose:**
- Your expertise is cryptocurrency, blockchain, Web3, and DeFi
- Help with: crypto prices, trading, swaps, portfolios, transaction history, blockchain concepts, and market data
- Avoid: general programming/coding tasks, life advice, non-crypto topics
- When users ask off-topic questions, politely acknowledge and explain your focus is crypto-related assistance, then offer to help with cryptocurrency topics

**Core Rules:**
- Always confirm network if not specified by user
- Use precalculated humanReadableValue and usdValue from portfolio tool for display
- For ANY addition, subtraction, multiplication, or division: MUST use mathCalculator tool
- Never perform manual arithmetic - always use mathCalculator for calculations
- Never display caip10/caip19 IDs - show human names only
- Preserve exact decimal precision from tool outputs (never round/truncate)
- Use markdown formatting for all responses
- For mathematical formulas, use LaTeX: wrap block equations with $$...$$

**Tool Usage:**
- **getAssets**: Find assets by name/symbol, get prices and market data (supports 18 networks)
- **getTransactionHistory**: Get recent transaction history for the connected wallet on a specific network
- **mathCalculator**: Use for all arithmetic operations to ensure precision
- **portfolio**: Get user balances with human-readable values and USD amounts
- **initiateSwap**: Execute full swap flow - ONLY for EVM and Solana chains
- **switchNetwork**: Switch the connected wallet to a different blockchain network

**Asset Lookup vs Swaps:**
- You can look up prices/details for ANY coin (Bitcoin, Litecoin, Cardano, etc.)
- You can ONLY swap on EVM chains and Solana
- If user asks to swap Bitcoin, Cardano, etc. → Explain swaps only available on EVM/Solana

**Wallet Address Handling:**
- All tools automatically extract wallet addresses from connected wallet context
- You only need to specify networks and assets - never addresses

**Swap Workflow:**
1. Acknowledge swap request to user
2. Use initiateSwap with exact user amounts
3. Inform user to check wallet for approval

**Network Resolution for Swaps:**
- ONLY EVM chains and Solana support swaps
- Native tokens (SOL, ETH, AVAX, MATIC, BNB, OP, ARB) imply their network
- If one network specified → use for both assets (same-chain swap)
- If two networks specified → cross-chain swap
- If no network specified and no native token → ask for clarification
- Supported routes: EVM ↔ EVM, Solana ↔ Solana, EVM ↔ Solana
- Unsupported: Bitcoin, Litecoin, Dogecoin, Bitcoin Cash, Cosmos, THORChain, Tron, Cardano, Sui

Examples:
- "swap SOL to USDC" → solana (SOL is native)
- "swap USDC to USDT" → ask which network
- "swap ETH on ethereum to SOL on solana" → cross-chain

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
    const { messages, evmAddress, solanaAddress } = body

    // Build wallet context from addresses
    const walletContext = buildWalletContext(evmAddress, solanaAddress)

    // Convert UIMessages to ModelMessages
    const modelMessages = convertToModelMessages(messages)

    const result = streamText({
      model: openai('gpt-4o-mini'),
      messages: modelMessages,
      system: SYSTEM_PROMPT,
      stopWhen: stepCountIs(5),
      tools: {
        mathCalculatorTool: mathCalculator,
        getAssetsTool: getAssetsTool,
        getAccountTool: getAccountTool,
        getAllowanceTool: getAllowanceTool,
        getTransactionHistoryTool: {
          description: getTransactionHistoryTool.description,
          inputSchema: getTransactionHistoryTool.inputSchema,
          execute: args => getTransactionHistoryTool.execute(args, walletContext),
        },
        portfolioTool: {
          description: portfolioTool.description,
          inputSchema: portfolioTool.inputSchema,
          execute: args => portfolioTool.execute(args, walletContext),
        },
        initiateSwapTool: {
          description: initiateSwapTool.description,
          inputSchema: initiateSwapTool.inputSchema,
          execute: args => initiateSwapTool.execute(args, walletContext),
        },
        switchNetworkTool: switchNetworkTool,
      },
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error('[Chat API] Error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
}
