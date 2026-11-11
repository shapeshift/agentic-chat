import { describe, expect, test } from 'bun:test'

import { assertQuoteFresh, isQuoteFresh, prepareFreshSwap, termsChanged } from '../prepareFreshSwap'
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
      swapData: { ...quote().swapData, buyAmountCryptoPrecision: '1' },
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

function withBuy(buyAmountCryptoPrecision: string): SwapQuote {
  return quote({ swapData: { ...quote().swapData, buyAmountCryptoPrecision } })
}
function withFee(networkFeeCrypto?: string, networkFeeUsd?: string): SwapQuote {
  return quote({
    summary: { ...quote().summary, exchange: { provider: 'relay', rate: '2', networkFeeCrypto, networkFeeUsd } },
  })
}

describe('updated quote tolerance', () => {
  test('buy amount may drop up to 0.5% without asking again', () => {
    const agreed = withBuy('200')
    expect(termsChanged(agreed, withBuy('199.0000000001'))).toBe(false)
    expect(termsChanged(agreed, withBuy('199'))).toBe(false)
    expect(termsChanged(agreed, withBuy('198.9999999999'))).toBe(true)
    expect(termsChanged(agreed, withBuy('150'))).toBe(true)
  })

  test('better output never asks', () => {
    expect(termsChanged(withBuy('200'), withBuy('200.1'))).toBe(false)
    expect(termsChanged(withBuy('200'), withBuy('1000'))).toBe(false)
  })

  test('exact decimals: tiny 18-decimal amounts are compared without float error', () => {
    const agreed = withBuy('0.000000000000001000')
    expect(termsChanged(agreed, withBuy('0.000000000000000995'))).toBe(false)
    expect(termsChanged(agreed, withBuy('0.000000000000000994'))).toBe(true)
  })

  test('network fee may rise up to 25%, and rises of $0.50 or less never ask', () => {
    const agreed = withFee('0.004', '10')
    expect(termsChanged(agreed, withFee('0.005', '12.5'))).toBe(false)
    expect(termsChanged(agreed, withFee('0.0050001', '12.51'))).toBe(true)
    // L2 gas noise: more than doubled, but only cents in USD.
    expect(termsChanged(withFee('0.000001', '0.02'), withFee('0.000003', '0.06'))).toBe(false)
    expect(termsChanged(withFee('0.0001', '0.4'), withFee('0.000225', '0.9'))).toBe(false)
    expect(termsChanged(withFee('0.0001', '0.4'), withFee('0.0002251', '0.9001'))).toBe(true)
  })

  test('lower fees never ask', () => {
    expect(termsChanged(withFee('0.004', '10'), withFee('0.001', '2.5'))).toBe(false)
  })

  test('without USD values, the relative fee rise alone decides', () => {
    expect(termsChanged(withFee('0.004'), withFee('0.005'))).toBe(false)
    expect(termsChanged(withFee('0.004'), withFee('0.0050001'))).toBe(true)
  })

  test('missing or unreadable new terms still ask', () => {
    expect(termsChanged(withBuy('200'), withBuy('not-a-number'))).toBe(true)
    expect(termsChanged(withFee('0.004', '10'), withFee(undefined, '10'))).toBe(true)
    expect(termsChanged(withFee(), withFee())).toBe(false)
  })

  test('a different provider or spender always asks', () => {
    expect(
      termsChanged(quote(), quote({ summary: { ...quote().summary, exchange: { provider: 'bebop', rate: '2' } } }))
    ).toBe(true)
    expect(termsChanged(quote(), quote({ swapData: { ...quote().swapData, approvalTarget: 'other' } }))).toBe(true)
  })

  test('small drops are measured against the agreed terms, so they cannot add up unseen', async () => {
    const refreshed = [withBuy('1.996'), withBuy('1.992')]
    const prompts: string[] = []
    let approvals = 0
    await prepareFreshSwap(withBuy('2'), {
      ...actions(),
      refresh: async () => refreshed.shift() ?? withBuy('1.992'),
      approve: async () => ++approvals === 1,
      confirm: async q => {
        prompts.push(q.swapData.buyAmountCryptoPrecision)
        return true
      },
    })
    // 0.2% and then 0.4% below the agreed 2: both within tolerance.
    expect(prompts).toEqual([])
  })

  test('cumulative drift past the tolerance asks once it crosses it', async () => {
    const refreshed = [withBuy('1.996'), withBuy('1.989')]
    const prompts: string[] = []
    let approvals = 0
    await prepareFreshSwap(withBuy('2'), {
      ...actions(),
      refresh: async () => refreshed.shift() ?? withBuy('1.989'),
      approve: async () => ++approvals === 1,
      confirm: async q => {
        prompts.push(q.swapData.buyAmountCryptoPrecision)
        return true
      },
    })
    // Each step is under 0.5%, but 2 -> 1.989 is 0.55% below what the user agreed to.
    expect(prompts).toEqual(['1.989'])
  })
})
