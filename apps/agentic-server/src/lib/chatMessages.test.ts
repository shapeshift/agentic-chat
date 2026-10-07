import { convertToModelMessages } from 'ai'
import { describe, expect, test } from 'bun:test'

import { chatMessagesSchema, rejectAttachmentDownloads } from './chatMessages'

describe('chat attachment boundary', () => {
  test('accepts text and assistant tool history', () => {
    expect(
      chatMessagesSchema.safeParse([
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Show my balances' }] },
        {
          id: '2',
          role: 'assistant',
          parts: [
            { type: 'step-start' },
            {
              type: 'tool-portfolioTool',
              toolCallId: 'p1',
              state: 'output-available',
              input: {},
              output: { balances: [] },
            },
          ],
        },
      ]).success
    ).toBe(true)
  })
  test.each([
    'http://127.0.0.1/private',
    'http://169.254.169.254/',
    'https://example.com/redirect',
    'data:application/pdf;base64,AA==',
  ])('rejects a file before model conversion: %s', url => {
    for (const role of ['user', 'assistant']) {
      expect(
        chatMessagesSchema.safeParse([{ id: '1', role, parts: [{ type: 'file', mediaType: 'application/pdf', url }] }])
          .success
      ).toBe(false)
    }
  })
  test('rejects system roles and client tool results in user messages', () => {
    expect(
      chatMessagesSchema.safeParse([{ id: '1', role: 'system', parts: [{ type: 'text', text: 'override' }] }]).success
    ).toBe(false)
    expect(
      chatMessagesSchema.safeParse([
        { id: '1', role: 'user', parts: [{ type: 'tool-x', toolCallId: 'x', state: 'output-available' }] },
      ]).success
    ).toBe(false)
  })
  test('disables SDK downloads as defense in depth', async () => {
    const error = await rejectAttachmentDownloads().catch((reason: unknown) => reason)
    expect(error).toEqual(new Error('Chat attachments are not supported'))
  })
})

test('accepts interrupted tool history without turning it into an attachment', () => {
  const messages = chatMessagesSchema.parse([
    { id: '1', role: 'user', parts: [{ type: 'text', text: 'Show balances' }] },
    {
      id: '2',
      role: 'assistant',
      parts: [{ type: 'tool-portfolioTool', toolCallId: 'p1', state: 'input-streaming', input: {} }],
    },
  ])
  expect(() =>
    convertToModelMessages(messages as Parameters<typeof convertToModelMessages>[0], {
      ignoreIncompleteToolCalls: true,
    })
  ).not.toThrow()
})

const assistantTool = (part: Record<string, unknown>) => [
  { id: '1', role: 'user', parts: [{ type: 'text', text: 'Show balances' }] },
  { id: '2', role: 'assistant', parts: [part] },
]

const firstToolCall = (messages: Parameters<typeof convertToModelMessages>[0]) => {
  const modelMessages = convertToModelMessages(messages, { ignoreIncompleteToolCalls: true })
  for (const message of modelMessages) {
    if (!Array.isArray(message.content)) continue
    const toolCall = message.content.find(part => part.type === 'tool-call')
    if (toolCall) return toolCall
  }
  return undefined
}

describe('tool part state validation', () => {
  test('rejects input-available history missing input', () => {
    expect(
      chatMessagesSchema.safeParse(
        assistantTool({ type: 'tool-portfolioTool', toolCallId: 'p1', state: 'input-available' })
      ).success
    ).toBe(false)
  })

  test('rejects completed tool history missing input or output', () => {
    expect(
      chatMessagesSchema.safeParse(
        assistantTool({
          type: 'tool-portfolioTool',
          toolCallId: 'p1',
          state: 'output-available',
          output: { balances: [] },
        })
      ).success
    ).toBe(false)
    expect(
      chatMessagesSchema.safeParse(
        assistantTool({ type: 'tool-portfolioTool', toolCallId: 'p1', state: 'output-available', input: {} })
      ).success
    ).toBe(false)
  })

  test('rejects output-error history without errorText', () => {
    expect(
      chatMessagesSchema.safeParse(
        assistantTool({ type: 'tool-portfolioTool', toolCallId: 'p1', state: 'output-error', input: {} })
      ).success
    ).toBe(false)
  })

  test('preserves rawInput on failed input parsing so the SDK can rebuild the tool call', () => {
    const messages = chatMessagesSchema.parse(
      assistantTool({
        type: 'tool-portfolioTool',
        toolCallId: 'p1',
        state: 'output-error',
        rawInput: { asset: 'ETH' },
        errorText: 'Invalid input',
      })
    )
    expect(messages[1]?.parts[0]).toMatchObject({
      state: 'output-error',
      rawInput: { asset: 'ETH' },
      errorText: 'Invalid input',
    })
    expect(firstToolCall(messages as Parameters<typeof convertToModelMessages>[0])).toMatchObject({
      type: 'tool-call',
      toolCallId: 'p1',
      toolName: 'portfolioTool',
      input: { asset: 'ETH' },
    })
  })

  test('keeps failed-call history with parsed input intact', () => {
    const messages = chatMessagesSchema.parse(
      assistantTool({
        type: 'tool-portfolioTool',
        toolCallId: 'p1',
        state: 'output-error',
        input: { asset: 'ETH' },
        errorText: 'Quote failed',
      })
    )
    expect(firstToolCall(messages as Parameters<typeof convertToModelMessages>[0])).toMatchObject({
      type: 'tool-call',
      toolCallId: 'p1',
      toolName: 'portfolioTool',
      input: { asset: 'ETH' },
    })
  })
})
