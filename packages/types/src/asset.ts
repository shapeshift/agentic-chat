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
  icon: z.string().optional().describe('The asset icon url'),
})

export const assetNamespace = z.enum(['erc20', 'erc721', 'erc1155', 'slip44']).describe(`
  The asset type as described the chain:
    - erc20 tokens will ALWAYS have an address associated with the asset
    - erc721/erc1155 nfts will ALWAYS have an address AND id associated with the asset
    - slip44 assets are ALWAYS the native asset on chain and don't have an address (eg. ETH)
`)

export type Asset = z.infer<typeof asset>
