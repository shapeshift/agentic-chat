import type { Asset } from '@shapeshiftoss/types'
import axios, { AxiosError } from 'axios'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'

import { getBebopRate } from '../getBebopRate'
import { getRelayRate } from '../getRelayRate'

const asset: Asset = {
  assetId: 'eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  chainId: 'eip155:1',
  symbol: 'USDC',
  name: 'USD Coin',
  network: 'ethereum',
  precision: 6,
  price: '1',
  icon: '',
}
const input = {
  address: '0x000000000000000000000000000000000000dEaD',
  sellAsset: asset,
  buyAsset: asset,
  sellAmountCryptoPrecision: '100',
}

describe('swap quote errors', () => {
  const restores: Array<() => void> = []
  afterEach(() => {
    restores.splice(0).forEach(restore => restore())
  })

  for (const [provider, method, getRate] of [
    ['Relay', 'post', getRelayRate],
    ['Bebop', 'get', getBebopRate],
  ] as const) {
    test(`${provider} preserves authentication status even with an ambiguous API message`, async () => {
      const request = spyOn(axios, method).mockRejectedValue(
        new AxiosError('Request failed', undefined, undefined, undefined, {
          status: 401,
          data: { message: 'Request rejected' },
          statusText: 'Unauthorized',
          headers: {},
          config: { headers: new axios.AxiosHeaders() },
        })
      )
      restores.push(() => request.mockRestore())
      const error = await getRate(input).then(
        () => undefined,
        (reason: Error) => reason
      )
      expect(error?.message).toBe(`${provider} (HTTP 401): Request rejected`)
    })
  }
})
