import type { InitiateSwapOutput } from '@shapeshiftoss/agentic-server'
import { afterAll, afterEach, describe, expect, spyOn, test } from 'bun:test'

import { refreshSwapQuote } from '../swapService'

const fetchSpy = spyOn(globalThis, 'fetch')
afterEach(() => fetchSpy.mockReset())
afterAll(() => fetchSpy.mockRestore())

const quote = {
  swapData: {
    sellAsset: { assetId: 'eip155:8453/erc20:0xusdc' },
    buyAsset: { assetId: 'eip155:1/erc20:0xfox' },
    sellAmountCryptoPrecision: '1',
    sellAccount: '0xsender',
    buyAccount: '0xsender',
  },
} as unknown as InitiateSwapOutput

describe('swap quote refresh', () => {
  test('sends the exact assets, amount and accounts', async () => {
    fetchSpy.mockResolvedValue(Response.json({ ok: true }))
    await refreshSwapQuote(quote)
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toEndWith('/api/swap/refresh')
    expect(JSON.parse(init.body as string)).toEqual({
      sellAssetId: 'eip155:8453/erc20:0xusdc',
      buyAssetId: 'eip155:1/erc20:0xfox',
      sellAmount: '1',
      sellAccount: '0xsender',
      buyAccount: '0xsender',
    })
  })

  test('surfaces the server error message', async () => {
    fetchSpy.mockResolvedValue(Response.json({ error: 'Failed to fetch swap quotes' }, { status: 502 }))
    expect(await refreshSwapQuote(quote).catch((error: Error) => error.message)).toBe('Failed to fetch swap quotes')
  })

  test('falls back to a readable message for non-JSON errors', async () => {
    for (const body of ['<html>Bad Gateway</html>', '404 Not Found', null]) {
      fetchSpy.mockResolvedValue(new Response(body, { status: 502 }))
      expect(await refreshSwapQuote(quote).catch((error: Error) => error.message)).toBe(
        'Unable to refresh swap quote. Please try again.'
      )
    }
  })
})
