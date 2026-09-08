import { describe, expect, test } from 'bun:test'

import { assertQuoteFresh, isQuoteFresh, prepareFreshSwap } from '../prepareFreshSwap'
import type { SwapQuote } from '../prepareFreshSwap'

const asset = {
  assetId: 'eip155:1/slip44:60',
  chainId: 'eip155:1',
  symbol: 'ETH',
  name: 'Ethereum',
  network: 'ethereum',
  precision: 18,
  price: '1',
  icon: '',
}
function quote(overrides: Partial<SwapQuote> = {}): SwapQuote {
  return {
    expiresAt: Date.now() + 60_000,
    needsApproval: false,
    swapTx: {
      chainId: asset.chainId,
      from: 'sender',
      to: 'spender',
      data: 'new-calldata',
      value: '1',
    },
    swapData: {
      sellAsset: asset,
      buyAsset: asset,
      sellAmountCryptoPrecision: '1',
      buyAmountCryptoPrecision: '2',
      sellAccount: 'sender',
      buyAccount: 'receiver',
      approvalTarget: 'spender',
    },
    summary: {
      sellAsset: {
        symbol: 'ETH',
        amount: '1',
        network: 'ethereum',
        chainName: 'Ethereum',
        valueUSD: null,
        priceUSD: null,
      },
      buyAsset: {
        symbol: 'ETH',
        estimatedAmount: '2',
        network: 'ethereum',
        chainName: 'Ethereum',
        estimatedValueUSD: null,
        priceUSD: null,
      },
      exchange: { provider: 'relay', rate: '2' },
      isCrossChain: false,
    },
    ...overrides,
  }
}
function actions() {
  return {
    refresh: async () => quote(),
    approve: async () => false,
    confirm: async () => true,
    show: () => {},
    assertWallet: () => {},
  }
}

describe('fresh swap preparation', () => {
  test('refreshes a legacy or expired quote instead of returning its transaction', async () => {
    for (const expiresAt of [undefined, Date.now() - 1]) {
      const fresh = quote()
      const result = await prepareFreshSwap(quote({ expiresAt }), {
        ...actions(),
        refresh: async () => fresh,
      })
      expect(result).toBe(fresh)
    }
  })

  test('accepts checksum casing in EVM transaction senders', async () => {
    const fresh = quote({ swapTx: { ...quote().swapTx, from: 'SENDER' } })
    expect(await prepareFreshSwap(quote(), { ...actions(), refresh: async () => fresh })).toBe(fresh)
  })

  test('refreshes after approval and checks the new spender before returning', async () => {
    const first = quote()
    const second = quote({
      swapData: {
        ...first.swapData,
        approvalTarget: 'new-spender',
        buyAmountCryptoPrecision: '3',
      },
    })
    const seen: string[] = []
    let refreshes = 0
    const result = await prepareFreshSwap(first, {
      ...actions(),
      refresh: async () => (++refreshes === 1 ? first : second),
      confirm: async q => {
        seen.push(`accept:${q.swapData.buyAmountCryptoPrecision}`)
        return true
      },
      approve: async q => {
        seen.push(q.swapData.approvalTarget)
        return seen.length === 1
      },
    })
    expect(seen).toEqual(['spender', 'accept:3', 'new-spender'])
    expect(result).toBe(second)
  })

  test('refreshes again if the user accepts after expiry', async () => {
    const changed = quote({
      swapData: { ...quote().swapData, buyAmountCryptoPrecision: '3' },
    })
    let refreshes = 0
    let approvals = 0
    await prepareFreshSwap(quote(), {
      ...actions(),
      refresh: async () => {
        refreshes++
        return { ...changed, expiresAt: Date.now() + 60_000 }
      },
      confirm: async q => {
        q.expiresAt = Date.now() - 1
        return true
      },
      approve: async () => {
        approvals++
        return false
      },
    })
    expect(refreshes).toBe(2)
    expect(approvals).toBe(1)
  })

  test('cancelled changed terms never reach approval or signing', async () => {
    let approvals = 0
    const next = quote({
      summary: {
        ...quote().summary,
        exchange: { provider: 'bebop', rate: '2' },
      },
    })
    const result = prepareFreshSwap(quote(), {
      ...actions(),
      refresh: async () => next,
      confirm: async () => false,
      approve: async () => {
        approvals++
        return false
      },
    })
    expect(result).rejects.toThrow('cancelled')
    await result.catch(() => {})
    expect(approvals).toBe(0)
  })

  test('fails closed when refresh fails', async () => {
    const result = prepareFreshSwap(quote(), {
      ...actions(),
      refresh: async () => {
        throw new Error('Provider unavailable')
      },
    })
    expect(result).rejects.toThrow('Provider unavailable')
    await result.catch(() => {})
  })

  test('rejects changed recipient, asset or sell amount', async () => {
    for (const change of [
      { buyAccount: 'other' },
      { sellAmountCryptoPrecision: '100' },
      { buyAsset: { ...asset, assetId: 'other' } },
    ]) {
      const result = prepareFreshSwap(quote(), {
        ...actions(),
        refresh: async () => quote({ swapData: { ...quote().swapData, ...change } }),
      })
      expect(result).rejects.toThrow('changed the requested swap')
      await result.catch(() => {})
    }
  })

  test('wallet change during refresh blocks approval', async () => {
    let connected = true
    const result = prepareFreshSwap(quote(), {
      ...actions(),
      refresh: async () => {
        connected = false
        return quote()
      },
      assertWallet: () => {
        if (!connected) throw new Error('Wallet changed')
      },
    })
    expect(result).rejects.toThrow('Wallet changed')
    await result.catch(() => {})
  })

  test('bounds repeated approvals instead of ever returning stale calldata', async () => {
    let approvals = 0
    const result = prepareFreshSwap(quote(), {
      ...actions(),
      approve: async () => {
        approvals++
        return true
      },
    })
    expect(result).rejects.toThrow('Unable to obtain a fresh')
    await result.catch(() => {})
    expect(approvals).toBe(5)
  })

  test('rejects missing, invalid, expired and nearly expired deadlines at signing', () => {
    for (const expiresAt of [undefined, NaN, Infinity, Date.now() - 1, Date.now() + 9_000]) {
      expect(isQuoteFresh(quote({ expiresAt }))).toBe(false)
      expect(() => assertQuoteFresh(quote({ expiresAt }))).toThrow('expired')
    }
    expect(isQuoteFresh(quote())).toBe(true)
  })
})
