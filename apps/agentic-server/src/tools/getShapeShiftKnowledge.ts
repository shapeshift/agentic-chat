import fs from 'fs/promises'
import path from 'path'

import { z } from 'zod'

const KNOWLEDGE_DIR = path.join(__dirname, '../knowledge/shapeshift')

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

export async function executeGetShapeShiftKnowledge(input: GetShapeShiftKnowledgeInput): Promise<string> {
  const { category } = input

  try {
    // Default to "all" if no category specified
    const selectedCategory = category || 'all'

    if (selectedCategory === 'all') {
      // Read all knowledge files
      const allKnowledge = await Promise.all(
        CATEGORIES.map(async cat => {
          const filePath = path.join(KNOWLEDGE_DIR, `${cat}.md`)
          const content = await fs.readFile(filePath, 'utf-8')
          return `\n\n# ${cat.toUpperCase()} #\n\n${content}`
        })
      )
      return allKnowledge.join('\n\n---\n\n')
    }

    // Read specific category
    const filePath = path.join(KNOWLEDGE_DIR, `${selectedCategory}.md`)
    const content = await fs.readFile(filePath, 'utf-8')

    return content
  } catch (error) {
    console.error('Error reading ShapeShift knowledge:', error)
    return `Failed to retrieve ShapeShift knowledge: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

export const getShapeShiftKnowledgeTool = {
  description:
    'Get information about ShapeShift platform, company, and DAO. Categories: company, platform, swappers, chains, staking, fox-token, features, mobile-app, or "all" for everything.',
  inputSchema: getShapeShiftKnowledgeSchema,
  execute: executeGetShapeShiftKnowledge,
}
