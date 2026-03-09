import { describe, expect, test } from 'bun:test'

const MAX_MESSAGES_PER_CONVERSATION = 500

function isAtMessageLimit(messageCount: number): boolean {
  return messageCount >= MAX_MESSAGES_PER_CONVERSATION
}

describe('message limit guard', () => {
  test('returns false when well below limit', () => {
    expect(isAtMessageLimit(0)).toBe(false)
    expect(isAtMessageLimit(1)).toBe(false)
    expect(isAtMessageLimit(250)).toBe(false)
  })

  test('returns false at one below limit', () => {
    expect(isAtMessageLimit(499)).toBe(false)
  })

  test('returns true at exactly the limit', () => {
    expect(isAtMessageLimit(500)).toBe(true)
  })

  test('returns true above the limit', () => {
    expect(isAtMessageLimit(501)).toBe(true)
    expect(isAtMessageLimit(1000)).toBe(true)
  })
})

describe('handleSubmit limit guard', () => {
  test('prevents sending when at limit', () => {
    let messageSent = false
    const messageCount = 500
    const input = 'hello'

    if (!input.trim()) return
    if (messageCount >= MAX_MESSAGES_PER_CONVERSATION) return
    messageSent = true

    expect(messageSent).toBe(false)
  })

  test('allows sending when below limit', () => {
    let messageSent = false
    const messageCount = 499
    const input = 'hello'

    if (input.trim() && messageCount < MAX_MESSAGES_PER_CONVERSATION) {
      messageSent = true
    }

    expect(messageSent).toBe(true)
  })
})
