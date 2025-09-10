import { createTool } from '@mastra/core'
import type { AssetNamespace } from '@shapeshiftoss/caip'
import { toAssetId } from '@shapeshiftoss/caip'
import type { Asset } from '@shapeshiftoss/types'
import { asset } from '@shapeshiftoss/types'
import { getNativeAssetReferenceByChainId, networkToChainIdMap } from '@shapeshiftoss/utils'
import z from 'zod'

const supportedNetworks = ['ethereum', 'optimism', 'arbitrum', 'polygon', 'avalanche', 'bsc', 'base', 'gnosis'] as const

export const assetConverterInput = z.object({
  assets: z.array(
    z.object({
      assetNamespace: z.enum(['erc20', 'erc721', 'erc1155', 'slip44']).describe(`
          The asset type as described the chain:
            - erc20 tokens will ALWAYS have an address associated with the asset
            - erc721/erc1155 nfts will ALWAYS have an address AND id associated with the asset
            - slip44 assets are ALWAYS the native asset on chain and don't have an address (eg. ETH)
        `),
      address: z
        .string()
        .optional()
        .nullable()
        .describe('The address of the token or undefined for native slip44 assets'),
      symbol: z.string(),
      name: z.string(),
      network: z.enum(supportedNetworks).or(z.string()).describe('The chain network the asset exists on'),
      decimals: z.number().describe('The decimal precision'),
      price: z.string().describe('The current market price of the asset'),
      imageUrl: z.string().optional().nullable().describe('The url for the asset image'),
    })
  ),
})

export const assetConverterOutput = z.object({
  assets: z.array(asset),
})

export type AssetConverterInput = z.infer<typeof assetConverterInput>
export type AssetConverterOutput = z.infer<typeof assetConverterOutput>

export const assetConverterTool = createTool({
  id: 'assetConverter',
  description: 'Converts common asset details into a standard asset format.',
  inputSchema: assetConverterInput,
  outputSchema: assetConverterOutput,
  execute: ({ context, mastra }) => {
    const logger = mastra!.getLogger()

    logger.info('assetConverterTool:', { context })

    const assets = context.assets.reduce<Asset[]>((prev, ctx) => {
      if (!(supportedNetworks as readonly string[]).includes(ctx.network)) return prev

      const chainId = networkToChainIdMap[ctx.network]

      if (!chainId) return prev

      const assetReference = (() => {
        try {
          if (ctx.assetNamespace === 'slip44') return getNativeAssetReferenceByChainId(chainId)
          return ctx.address
        } catch {}
      })()

      if (!assetReference) return prev

      const assetId = toAssetId({
        chainId,
        assetNamespace: ctx.assetNamespace as AssetNamespace,
        assetReference,
      })

      prev.push({
        assetId,
        chainId,
        symbol: ctx.symbol,
        name: ctx.name,
        network: ctx.network,
        precision: ctx.decimals,
        price: ctx.price,
        icon: ctx.imageUrl ?? '',
      })

      return prev
    }, [])

    return Promise.resolve({ assets })
  },
})
