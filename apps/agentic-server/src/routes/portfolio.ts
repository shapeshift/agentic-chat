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
import { NETWORKS } from '@shapeshiftoss/types'
import type { Context } from 'hono'
import { z } from 'zod'

import { getPortfolioData } from '../tools/portfolio'
import type { WalletContext } from '../utils/walletContextSimple'

const portfolioRequestSchema = z
  .object({
    network: z.enum(NETWORKS),
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
    const { network, evmAddress, solanaAddress } = validatedBody

    const walletContext = buildWalletContext(evmAddress, solanaAddress)

    const portfolioData = await getPortfolioData({ network }, walletContext)

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
