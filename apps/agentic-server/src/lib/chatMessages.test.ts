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
