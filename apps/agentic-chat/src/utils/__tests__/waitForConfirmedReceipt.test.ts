import { describe, expect, it, mock, beforeEach } from 'bun:test'

// Mock @wagmi/core before importing the module under test
const mockWaitForTransactionReceipt = mock(() => Promise.resolve({ status: 'success' }))
const mockGetPublicClient = mock(() => ({
  waitForTransactionReceipt: mockWaitForTransactionReceipt,
}))

mock.module('@wagmi/core', () => ({
  getPublicClient: mockGetPublicClient,
}))

mock.module('@/lib/wagmi-config', () => ({
  wagmiConfig: {},
}))

const { waitForConfirmedReceipt } = await import('../waitForConfirmedReceipt')

describe('waitForConfirmedReceipt', () => {
  beforeEach(() => {
    mockGetPublicClient.mockClear()
    mockWaitForTransactionReceipt.mockClear()
    mockWaitForTransactionReceipt.mockImplementation(() => Promise.resolve({ status: 'success' }))
    mockGetPublicClient.mockImplementation(() => ({
      waitForTransactionReceipt: mockWaitForTransactionReceipt,
    }))
  })

  it('wraps waitForTransactionReceipt with retry', async () => {
    let calls = 0
    mockWaitForTransactionReceipt.mockImplementation(() => {
      calls++
      if (calls < 2) return Promise.reject(new Error('ECONNRESET'))
      return Promise.resolve({ status: 'success' })
    })

    await waitForConfirmedReceipt(1, '0xabc')

    expect(calls).toBe(2)
  })

  it('does not retry non-retryable errors', async () => {
    mockWaitForTransactionReceipt.mockImplementation(() =>
      Promise.reject(new Error('insufficient funds'))
    )

    await expect(waitForConfirmedReceipt(1, '0xabc')).rejects.toThrow('insufficient funds')
    expect(mockWaitForTransactionReceipt).toHaveBeenCalledTimes(1)
  })

  it('still throws on reverted transactions', async () => {
    mockWaitForTransactionReceipt.mockImplementation(() =>
      Promise.resolve({ status: 'reverted' })
    )

    await expect(waitForConfirmedReceipt(1, '0xabc')).rejects.toThrow('Transaction reverted')
  })
})
