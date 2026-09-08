import type { LanguageModelV2, LanguageModelV2CallOptions } from '@ai-sdk/provider'
import { convertToModelMessages, generateText, stepCountIs } from 'ai'
import type { UIMessage } from 'ai'
import { describe, expect, test } from 'bun:test'
import { z } from 'zod'

import { createLimitOrderTool } from '../../tools/limitOrder/createLimitOrder'
import { createStopLossTool } from '../../tools/stopLoss/createStopLoss'
import { createTwapTool } from '../../tools/twap/createTwap'
import { wrapTools } from '../wrapTools'

const rawOutput = {
  summary: { sellAsset: { symbol: 'USDC', amount: '1000' } },
  needsApproval: true,
  needsDeposit: true,
  warnings: ['small trade'],
  trackingUrl: 'https://explorer.cow.fi',
  orderParams: { sellAmount: '1000000000' },
  signingData: { message: { sellAmount: '1000000000' } },
  sellAmountBaseUnit: '1000000000',
  sellPrecision: 6,
  approvalTx: { data: '0xprivate' },
  depositTx: { data: '0xprivate' },
  safeTransaction: { data: '0xprivate' },
  conditionalOrderParams: { staticInput: '0xprivate' },
}

// Exercise the real output hooks with a fixture containing every private field.
const orderTools = { createLimitOrderTool, createStopLossTool, createTwapTool }

describe('order tool model output', () => {
  for (const [name, definition] of Object.entries(orderTools)) {
    const tools = wrapTools({
      [name]: {
        ...definition,
        inputSchema: z.object({}),
        execute: () => rawOutput,
        toModelOutput: (output: typeof rawOutput) => definition.toModelOutput(output as never),
      },
    })

    test(`${name} filters the next model step without changing the UI result`, async () => {
      const calls: LanguageModelV2CallOptions[] = []
      const responses: Awaited<ReturnType<LanguageModelV2['doGenerate']>>[] = [
        {
          content: [{ type: 'tool-call', toolCallId: 'call-1', toolName: name, input: '{}' }],
          finishReason: 'tool-calls',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          warnings: [],
        },
        {
          content: [{ type: 'text', text: 'Order ready' }],
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          warnings: [],
        },
      ]
      const model: LanguageModelV2 = {
        specificationVersion: 'v2',
        provider: 'test',
        modelId: 'test',
        supportedUrls: {},
        doGenerate: options => {
          calls.push(options)
          return Promise.resolve(responses[calls.length - 1]!)
        },
        doStream: () => {
          throw new Error('Not used')
        },
      }
      const result = await generateText({ model, tools, prompt: 'Create an order', stopWhen: stepCountIs(2) })
      expect(result.steps[0]?.toolResults[0]?.output).toEqual(rawOutput)
      const prompt = JSON.stringify(calls[1]?.prompt)
      expect(prompt).toContain('1000')
      expect(prompt).toContain('needsApproval')
      expect(prompt).not.toContain('1000000000')
      expect(prompt).not.toContain('0xprivate')
      expect(prompt).not.toContain('signingData')
    })

    test(`${name} filters replayed history and preserves the stored UI message`, () => {
      const messages: UIMessage[] = [
        {
          id: 'message-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: name,
              toolCallId: 'call-1',
              state: 'output-available',
              input: {},
              output: rawOutput,
            },
          ],
        },
      ]
      const before = JSON.stringify(messages)
      const converted = JSON.stringify(convertToModelMessages(messages, { tools }))
      expect(converted).toContain('1000')
      expect(converted).not.toContain('1000000000')
      expect(converted).not.toContain('0xprivate')
      expect(JSON.stringify(messages)).toBe(before)
    })
  }
})
