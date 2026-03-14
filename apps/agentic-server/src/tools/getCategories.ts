import { z } from 'zod'

import { getCategories } from '../lib/asset/coingecko'
import type { CategoryData, TrimmedCategory } from '../lib/asset/coingecko/types'

export const getCategoriesSchema = z.object({
  sortBy: z
    .enum(['market_cap', 'market_cap_change_24h'])
    .optional()
    .describe('Sort by market cap or 24h change (default: market_cap_change_24h for trending categories)'),
  limit: z.number().min(1).max(20).optional().describe('Number of categories to return (default: 10, max: 20)'),
})

export type GetCategoriesInput = z.infer<typeof getCategoriesSchema>

export type GetCategoriesOutput = {
  categories: TrimmedCategory[]
  sortedBy: string
}

export async function executeGetCategories(input: GetCategoriesInput): Promise<GetCategoriesOutput> {
  const sortBy = input.sortBy ?? 'market_cap_change_24h'
  const limit = input.limit ?? 10

  const order = sortBy === 'market_cap' ? 'market_cap_desc' : 'market_cap_change_24h_desc'
  const data = await getCategories(order)

  const categories: TrimmedCategory[] = data.slice(0, limit).map((cat: CategoryData) => ({
    id: cat.id,
    name: cat.name,
    marketCap: cat.market_cap ?? null,
    marketCapChange24h: cat.market_cap_change_24h ?? null,
    volume24h: cat.volume_24h ?? null,
    topCoins: cat.top_3_coins_id ?? [],
  }))

  return { categories, sortedBy: sortBy }
}

export const getCategoriesTool = {
  description: 'Get crypto market categories. No UI card - format and present the category data in your response.',
  inputSchema: getCategoriesSchema,
  execute: executeGetCategories,
}
