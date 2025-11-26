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

import { getConnectedNetworks, getPortfolioData } from '../tools/portfolio'
import type { WalletContext } from '../utils/walletContextSimple'

const portfolioRequestSchema = z
  .object({
    networks: z.array(z.enum(EVM_SOLANA_NETWORKS)).optional(),
    evmAddress: z.string().optional(),
    solanaAddress: z.string().optional(),
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

export async function handlePortfolioRequest(c: Context) {
  try {
    const body = await c.req.json()
    const validatedBody = portfolioRequestSchema.parse(body)
    const { networks, evmAddress, solanaAddress } = validatedBody

    const walletContext = buildWalletContext(evmAddress, solanaAddress)
    const networksToFetch = networks || getConnectedNetworks(walletContext)

    if (networksToFetch.length === 0) {
      return c.json({ error: 'No networks available for the provided addresses' }, 400)
    }

    const portfolioData = await getPortfolioData({ networks: networksToFetch }, walletContext)

    return c.json(portfolioData)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request body', details: error.issues }, 400)
    }
    console.error('[Portfolio Error]:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ error: 'Failed to fetch portfolio', message: errorMessage }, 500)
  }
}
