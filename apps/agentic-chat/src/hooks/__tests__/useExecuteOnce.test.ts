import { describe, expect, test } from 'bun:test'

import { shouldExecuteTool } from '../useExecuteOnce'

describe('tool execution guards', () => {
  test('a new tool call executes once', () => {
    expect(shouldExecuteTool({ persisted: false, running: false, historical: false })).toBe(true)
    expect(shouldExecuteTool({ persisted: false, running: true, historical: false })).toBe(false)
  })

  test('a finished tool never executes again', () => {
    expect(shouldExecuteTool({ persisted: true, running: false, historical: false })).toBe(false)
  })

  test('an unfinished tool reopened from a saved conversation never executes', () => {
    // Reload during approval, then reopen the conversation: nothing is persisted or running.
    expect(shouldExecuteTool({ persisted: false, running: false, historical: true })).toBe(false)
  })
})
