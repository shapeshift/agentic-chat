import { describe, expect, it } from 'bun:test'

import { STORE_VERSION } from '../chatStore'

describe('chatStore migration', () => {
  it('has STORE_VERSION 3', () => {
    expect(STORE_VERSION).toBe(3)
  })
})
