import { z } from 'zod'

import { shapeshiftKnowledge } from '../knowledge/shapeshift'

const CATEGORIES = [
  'company',
  'platform',
  'swappers',
  'chains',
  'staking',
  'fox-token',
  'features',
  'mobile-app',
] as const

export const getShapeShiftKnowledgeSchema = z.object({
  category: z
    .enum(['company', 'platform', 'swappers', 'chains', 'staking', 'fox-token', 'features', 'mobile-app', 'all'])
    .optional()
    .describe(
      'The category of knowledge to retrieve. If not specified, will try to return relevant information based on context.'
    ),
})

export type GetShapeShiftKnowledgeInput = z.infer<typeof getShapeShiftKnowledgeSchema>

export function executeGetShapeShiftKnowledge(input: GetShapeShiftKnowledgeInput): string {
  const { category } = input
  const selectedCategory = category || 'all'

  if (selectedCategory === 'all') {
    return CATEGORIES.map(cat => `\n\n# ${cat.toUpperCase()} #\n\n${shapeshiftKnowledge[cat]}`).join('\n\n---\n\n')
  }

  return shapeshiftKnowledge[selectedCategory]
}

export const getShapeShiftKnowledgeTool = {
  description: 'Get ShapeShift platform info. No UI card - format and present the information in your response.',
  inputSchema: getShapeShiftKnowledgeSchema,
  execute: executeGetShapeShiftKnowledge,
}
