import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModelV2 } from '@ai-sdk/provider'

// Anthropic provider (direct API)
export const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Venice AI provider (OpenAI-compatible API)
export const venice = createOpenAICompatible({
  name: 'venice',
  baseURL: 'https://api.venice.ai/api/v1',
  headers: {
    Authorization: `Bearer ${process.env.VENICE_API_KEY}`,
  },
})

// Model configurations
const models = {
  anthropic: {
    model: 'claude-haiku-4-5',
    provider: anthropic,
  },
  venice: {
    model: 'grok-41-fast',
    provider: venice,
  },
} as const

export type AIProvider = keyof typeof models

/**
 * Get the current AI provider name.
 */
export function getProviderName(): AIProvider {
  return (process.env.AI_PROVIDER || 'anthropic') as AIProvider
}

/**
 * Get the configured model based on AI_PROVIDER environment variable.
 * Defaults to 'anthropic' if not set.
 */
export function getModel(): LanguageModelV2 {
  const provider = getProviderName()
  const config = models[provider] || models.anthropic

  console.log(`[AI] Using provider: ${provider}, model: ${config.model}`)

  return config.provider(config.model)
}
