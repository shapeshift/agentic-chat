import { createTool } from '@mastra/core'
import type { AssetNamespace } from '@shapeshiftoss/caip'
import { toAssetId } from '@shapeshiftoss/caip'
import type { Asset } from '@shapeshiftoss/types'
import { asset } from '@shapeshiftoss/types'
import { networkToChainIdMap } from '@shapeshiftoss/utils'
import z from 'zod'

const supportedNetworks = ['ethereum', 'optimism', 'arbitrum', 'polygon', 'avalanche', 'bsc', 'base', 'gnosis'] as const

export const assetConverterTool = createTool({
  id: 'assetConverter',
  description: 'Converts common asset details into a standard asset format.',
  inputSchema: z.object({
    assets: z.array(
      z.object({
        assetNamespace: z.enum(['erc20', 'erc721', 'erc1155', 'slip44']).describe(`
          The asset type as described the chain:
            - erc20 tokens will ALWAYS have an address associated with the asset
            - erc721/erc1155 nfts will ALWAYS have an address AND id associated with the asset
            - slip44 assets are ALWAYS the native asset on chain and don't have an address (eg. ETH)
        `),
        address: z.string().optional().describe('The address of the token (use undefined for slip44 native assets)'),
        symbol: z.string(),
        name: z.string(),
        network: z.enum(supportedNetworks).or(z.string()).describe('The chain network the asset exists on'),
        decimals: z.number().describe('The decimal precision'),
        price: z.string().describe('The current market price of the asset'),
        imageUrl: z.string().optional(),
      })
    ),
  }),
  outputSchema: z.object({
    assets: z.array(asset),
  }),
  execute: ({ context, mastra }) => {
    const logger = mastra!.getLogger()

    logger.info('assetConverterTool:', { context })

    const assets = context.assets.reduce<Asset[]>((prev, ctx) => {
      if (!(supportedNetworks as readonly string[]).includes(ctx.network)) return prev

      const chainId = networkToChainIdMap[ctx.network]

      if (!chainId) return prev

      const assetId = toAssetId({
        chainId,
        assetNamespace: ctx.assetNamespace as AssetNamespace,
        assetReference: ctx.address || '60',
      })

      prev.push({
        assetId,
        chainId,
        symbol: ctx.symbol,
        name: ctx.name,
        network: ctx.network,
        precision: ctx.decimals,
        price: ctx.price,
        icon: ctx.imageUrl,
      })

      return prev
    }, [])

    return Promise.resolve({ assets })
  },
})
