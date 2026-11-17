import type { InitiateSwapOutput } from '@shapeshiftoss/agentic-server'
import { describe, expect, test } from 'bun:test'

import { getLiveWallet, setLiveWallet } from '@/lib/liveWallet'
import {
  UNREVIEWED_QUOTE_ERROR,
  answerQuotePrompt,
  isAwaitingQuoteAcceptance,
  mountQuoteView,
  requestQuoteAcceptance,
} from '@/lib/swapQuotePrompts'
import { QUOTE_SIGNING_BUFFER_MS, assertSwapWallet, prepareFreshSwap } from '@/utils/prepareFreshSwap'

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
function quote(buyAmount = '2', expiresAt = Date.now() + 60_000): InitiateSwapOutput {
  return {
    expiresAt,
    needsApproval: false,
    swapTx: { chainId: asset.chainId, from: '0xabc', to: '0xspender', data: '0x', value: '0' },
    swapData: {
      sellAsset: asset,
      buyAsset: asset,
      sellAmountCryptoPrecision: '1',
      buyAmountCryptoPrecision: buyAmount,
      sellAccount: '0xabc',
      buyAccount: '0xabc',
      approvalTarget: '0xspender',
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
        estimatedAmount: buyAmount,
        network: 'ethereum',
        chainName: 'Ethereum',
        estimatedValueUSD: null,
        priceUSD: null,
      },
      exchange: { provider: 'relay', rate: '2' },
      isCrossChain: false,
    },
  }
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0))
let nextId = 0
const toolCallId = () => `swap-prompt-${++nextId}`

describe('swap quote prompts across card remounts', () => {
  test('a prompt raised while the card is mounted survives an unmount and remount', async () => {
    const id = toolCallId()
    const unmount = mountQuoteView(id)
    const answer = requestQuoteAcceptance(id, Date.now() + 60_000)
    unmount()
    expect(isAwaitingQuoteAcceptance(id)).toBe(true)
    const unmountAgain = mountQuoteView(id)
    expect(isAwaitingQuoteAcceptance(id)).toBe(true)
    answerQuotePrompt(id, true)
    expect(await answer).toBe(true)
    expect(isAwaitingQuoteAcceptance(id)).toBe(false)
    unmountAgain()
  })

  test('an unseen prompt fails once its quote can no longer be signed', async () => {
    const id = toolCallId()
    const answer = requestQuoteAcceptance(id, Date.now() + QUOTE_SIGNING_BUFFER_MS + 20)
    expect(isAwaitingQuoteAcceptance(id)).toBe(true)
    expect(answer).rejects.toThrow(UNREVIEWED_QUOTE_ERROR)
    await answer.catch(() => {})
    expect(isAwaitingQuoteAcceptance(id)).toBe(false)
  })

  test('remounting before the deadline keeps an unseen prompt alive', async () => {
    const id = toolCallId()
    const answer = requestQuoteAcceptance(id, Date.now() + QUOTE_SIGNING_BUFFER_MS + 20)
    const unmount = mountQuoteView(id)
    await new Promise(resolve => setTimeout(resolve, 40))
    expect(isAwaitingQuoteAcceptance(id)).toBe(true)
    answerQuotePrompt(id, false)
    expect(await answer).toBe(false)
    unmount()
  })

  test('unmounting during approval does not abort, and a remounted card answers the next prompt', async () => {
    const id = toolCallId()
    let unmount = mountQuoteView(id)
    let refreshes = 0
    const result = prepareFreshSwap(quote(), {
      refresh: async () => (++refreshes === 1 ? quote() : quote('1.9')),
      approve: async () => {
        // Card scrolled out of the virtualized list while the approval confirms.
        unmount()
        return refreshes === 1
      },
      confirm: q => requestQuoteAcceptance(id, q.expiresAt),
      show: () => {},
      assertWallet: () => {},
    })
    while (!isAwaitingQuoteAcceptance(id)) await tick()
    unmount = mountQuoteView(id)
    answerQuotePrompt(id, true)
    expect((await result).swapData.buyAmountCryptoPrecision).toBe('1.9')
    expect(refreshes).toBe(2)
    unmount()
  })

  test('wallet checks read the live wallet, so a change while unmounted still blocks signing', () => {
    const previous = getLiveWallet()
    try {
      setLiveWallet({ evmAddress: '0xABC' })
      expect(() => assertSwapWallet(quote(), getLiveWallet())).not.toThrow()
      setLiveWallet({ evmAddress: '0xdef' })
      expect(() => assertSwapWallet(quote(), getLiveWallet())).toThrow('Wallet changed')
      setLiveWallet({})
      expect(() => assertSwapWallet(quote(), getLiveWallet())).toThrow('Wallet changed')
    } finally {
      setLiveWallet(previous)
    }
  })
})
