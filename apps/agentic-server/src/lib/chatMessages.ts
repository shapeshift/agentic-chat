import { z } from 'zod'

const textPart = z.object({ type: z.literal('text'), text: z.string().max(16_000) })
const toolPartBase = z.object({
  type: z.string().regex(/^tool-[a-zA-Z][a-zA-Z0-9]*$/),
  toolCallId: z.string().min(1).max(200),
})
const toolPart = z.discriminatedUnion('state', [
  toolPartBase.extend({
    state: z.literal('input-streaming'),
    input: z.unknown().optional(),
  }),
  toolPartBase.extend({
    state: z.literal('input-available'),
    // Zod 4 treats z.unknown() as present-or-absent; require the completed-call fields.
    input: z.unknown().nonoptional(),
  }),
  toolPartBase.extend({
    state: z.literal('output-available'),
    input: z.unknown().nonoptional(),
    output: z.unknown().nonoptional(),
  }),
  toolPartBase.extend({
    state: z.literal('output-error'),
    input: z.unknown().optional(),
    rawInput: z.unknown().optional(),
    errorText: z.string().max(1000),
  }),
])

export const chatMessagesSchema = z
  .array(
    z.discriminatedUnion('role', [
      z.object({ id: z.string().max(200), role: z.literal('user'), parts: z.array(textPart).min(1).max(20) }),
      z.object({
        id: z.string().max(200),
        role: z.literal('assistant'),
        parts: z
          .array(
            z.union([
              textPart,
              toolPart,
              z.object({ type: z.literal('step-start') }),
              z.object({ type: z.literal('reasoning'), text: z.string().max(16_000) }),
            ])
          )
          .max(100),
      }),
    ])
  )
  .min(1)
  .max(50)

export const rejectAttachmentDownloads = (): Promise<never> =>
  Promise.reject(new Error('Chat attachments are not supported'))
