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
import { EVM_SOLANA_NETWORKS } from '@shapeshiftoss/types'
import type { Context } from 'hono'
import { z } from 'zod'

import type { ServerEnv } from '../lib/requestBudget'
import { getConnectedNetworks, getPortfolioData } from '../tools/portfolio'
import type { WalletContext } from '../utils/walletContextSimple'

const portfolioRequestSchema = z
  .object({
    includeFailures: z.boolean().optional(),
    networks: z.array(z.enum(EVM_SOLANA_NETWORKS)).max(9).optional(),
    evmAddress: z
      .string()
      .regex(/^0x[0-9a-fA-F]{40}$/)
      .optional(),
    solanaAddress: z
      .string()
      .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)
      .optional(),
  })
  .refine(data => data.evmAddress || data.solanaAddress, {
    message: 'At least one address (evmAddress or solanaAddress) must be provided',
  })

function buildWalletContext(evmAddress?: string, solanaAddress?: string): WalletContext {
  const connectedWallets: Record<string, { address: string }> = {}

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

  if (solanaAddress) {
    connectedWallets[solanaChainId] = { address: solanaAddress }
  }

  return { connectedWallets }
}

export async function handlePortfolioRequest(c: Context<ServerEnv>) {
  try {
    const body = await c.req.json()
    const validatedBody = portfolioRequestSchema.parse(body)
    const { networks, evmAddress, solanaAddress, includeFailures } = validatedBody

    const walletContext = buildWalletContext(evmAddress, solanaAddress)
    const networksToFetch = [...new Set(networks || getConnectedNetworks(walletContext))]

    if (networksToFetch.length === 0) {
      return c.json({ error: 'No networks available for the provided addresses' }, 400)
    }

    const portfolioData = await getPortfolioData({ networks: networksToFetch }, walletContext)

    c.get('requestSignal').throwIfAborted()
    if (includeFailures) return c.json(portfolioData)
    // Keep the legacy array response without presenting incomplete data as a complete portfolio.
    if (portfolioData.failedNetworks.length > 0) {
      return c.json(
        {
          error: 'Failed to fetch portfolio',
          failedNetworks: portfolioData.failedNetworks,
        },
        503
      )
    }
    return c.json(portfolioData.networks)
  } catch (error) {
    if (c.get('requestSignal').aborted) return c.json({ error: 'Request timed out or cancelled' }, 504)
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request body', details: error.issues }, 400)
    }
    console.error('[Portfolio Error]:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: 'Failed to fetch portfolio', message: errorMessage }, 500)
  }
}
