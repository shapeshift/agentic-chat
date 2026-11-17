import type { Asset } from '@shapeshiftoss/types'
import axios from 'axios'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'

import { getBebopRate } from '../getBebopRate'

const usdc: Asset = {
  assetId: 'eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  chainId: 'eip155:8453',
  symbol: 'USDC',
  name: 'USD Coin',
  network: 'base',
  precision: 6,
  price: '1',
  icon: '',
}
const weth: Asset = {
  ...usdc,
  assetId: 'eip155:8453/erc20:0x4200000000000000000000000000000000000006',
  symbol: 'WETH',
  precision: 18,
}
const input = {
  address: '0x000000000000000000000000000000000000dEaD',
  sellAsset: usdc,
  buyAsset: weth,
  sellAmountCryptoPrecision: '1',
}

// Shaped like a live router response: PMMv3 first with ~10s left, JAMv2 with ~90s.
function route(type: string, secondsLeft: number, approvalTarget: string) {
  return {
    type,
    quote: {
      expiry: Math.floor(Date.now() / 1000) + secondsLeft,
      approvalTarget,
      buyTokens: { '0x4200000000000000000000000000000000000006': { amount: '479000000000000', decimals: 18 } },
      gasFee: { native: '0', usd: 0 },
      tx: { chainId: 8453, from: input.address, to: approvalTarget, value: '0x0', data: '0x' },
    },
  }
}

describe('Bebop route expiry', () => {
  const restores: Array<() => void> = []
  afterEach(() => restores.splice(0).forEach(restore => restore()))
  const respond = (routes: unknown[]) => {
    const request = spyOn(axios, 'get').mockResolvedValue({ data: { routes } })
    restores.push(() => request.mockRestore())
  }

  test('skips a route that expires before it could be signed', async () => {
    respond([route('PMMv3', 10, '0xpmm'), route('JAMv2', 90, '0xjam')])
    const rate = await getBebopRate(input)
    expect(rate.approvalTarget).toBe('0xjam')
    expect(rate.expiresAt).toBeGreaterThan(Date.now() + 80_000)
  })

  test('keeps Bebop route order when the first route lasts long enough', async () => {
    respond([route('PMMv3', 60, '0xpmm'), route('JAMv2', 90, '0xjam')])
    expect((await getBebopRate(input)).approvalTarget).toBe('0xpmm')
  })

  test('fails when every route expires too soon', async () => {
    respond([route('PMMv3', 10, '0xpmm'), route('JAMv2', 29, '0xjam')])
    expect(await getBebopRate(input).catch((error: Error) => error.message)).toBe(
      'Bebop: All routes expire too soon to sign'
    )
  })
})
