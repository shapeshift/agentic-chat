import z from 'zod'

export const asset = z.object({
  assetId: z
    .string()
    .describe('The asset id in caip-19 format chainId/assetNamespace:assetReference (ex. eip155:1/slip44:60)'),
  chainId: z.string().describe('The chain id in caip-2 format chainNamespace:chainReference (ex. eip155:1)'),
  symbol: z.string().describe('The asset symbol'),
  name: z.string().describe('The asset name'),
  network: z.string().describe('The asset network'),
  precision: z.number().describe('The asset decimal precision'),
  price: z.string().describe('The current market price'),
  icon: z.string().describe('The asset icon url'),
  color: z.string().optional().describe('The asset color for UI theming'),
  icons: z.array(z.string()).optional().describe('Multiple icon URLs (if available)'),
  isPool: z.boolean().optional().describe('Whether this asset is a pool token'),
  relatedAssetKey: z
    .string()
    .optional()
    .describe('The assetId of the primary asset in a group of related assets (e.g., USDC on different chains)'),
  isPrimary: z.boolean().optional().describe('Whether this is the primary implementation of a multi-chain asset'),
  isChainSpecific: z
    .boolean()
    .optional()
    .describe('Whether this asset only exists on one chain (e.g., native chain assets)'),
})

export type Asset = z.infer<typeof asset>

export type StaticAsset = Omit<Asset, 'price' | 'network'>
