import { expect, mock, test } from 'bun:test'

import { createReadOnlySafeProvider } from '../types'

test('Safe discovery does not send wallet account requests to public RPCs', async () => {
  const request = mock(() => Promise.resolve('0x38'))
  const provider = createReadOnlySafeProvider({ request })
  expect(await provider.request({ method: 'eth_accounts' })).toEqual([])
  expect(request).not.toHaveBeenCalled()
  expect(await provider.request({ method: 'eth_chainId' })).toBe('0x38')
  expect(request).toHaveBeenCalledWith({ method: 'eth_chainId' })
})
