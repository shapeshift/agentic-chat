import { createOpenAI } from '@ai-sdk/openai'

export const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export const venice = createOpenAI({
  apiKey: process.env.VENICE_API_KEY,
  baseURL: 'https://api.venice.ai/api/v1',
})
