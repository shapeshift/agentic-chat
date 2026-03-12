import { describe, expect, test } from 'bun:test'

import { withWalletLock } from './walletMutex'

describe('withWalletLock', () => {
  test('serializes concurrent calls', async () => {
    const order: number[] = []

    const first = withWalletLock(async () => {
      order.push(1)
      await new Promise(r => setTimeout(r, 50))
      order.push(2)
      return 'a'
    })

    const second = withWalletLock(async () => {
      order.push(3)
      await new Promise(r => setTimeout(r, 10))
      order.push(4)
      return 'b'
    })

    const [resultA, resultB] = await Promise.all([first, second])

    expect(order).toEqual([1, 2, 3, 4])
    expect(resultA).toBe('a')
    expect(resultB).toBe('b')
  })

  test('releases lock on rejection so next call proceeds', async () => {
    const failing = withWalletLock(async () => {
      throw new Error('boom')
    })

    // eslint-disable-next-line @typescript-eslint/await-thenable
    await expect(failing).rejects.toThrow('boom')

    const result = await withWalletLock(async () => 'recovered')
    expect(result).toBe('recovered')
  })

  test('returns the callback return value', async () => {
    const result = await withWalletLock(async () => 42)
    expect(result).toBe(42)
  })
})
