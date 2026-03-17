// @ts-nocheck — test assertions use non-null `!` on results we know exist
import { describe, expect, test } from 'bun:test'

import { parseEvmTransaction } from '../evmParser'
import type { EvmTx } from '../schemas'

const USER = '0xUser1234567890abcdef1234567890abcdef123456'
const OTHER = '0xOther234567890abcdef1234567890abcdef123456'
const ROUTER = '0xRouter34567890abcdef1234567890abcdef123456'
const USDC_CONTRACT = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const DAI_CONTRACT = '0x6b175474e89094c44da98b954eedeac495271d0f'
const WETH_CONTRACT = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'

function makeTx(overrides: Partial<EvmTx> = {}): EvmTx {
  return {
    txid: '0xabc',
    blockHeight: 100,
    timestamp: 1704067200,
    status: 1,
    from: USER,
    to: OTHER,
    confirmations: 10,
    value: '0',
    fee: '1000000000000000',
    ...overrides,
  }
}

function makeTokenTransfer(overrides: Partial<EvmTx['tokenTransfers']![0]> = {}) {
  return {
    contract: USDC_CONTRACT,
    decimals: 6,
    name: 'USD Coin',
    symbol: 'USDC',
    type: 'ERC20',
    from: USER,
    to: OTHER,
    value: '1000000',
    ...overrides,
  }
}

describe('parseEvmTransaction', () => {
  describe('transaction classification', () => {
    test('classifies native ETH send from user', () => {
      const tx = makeTx({ from: USER, to: OTHER, value: '1000000000000000000' })
      const result = parseEvmTransaction(tx, USER, 'ethereum')
      expect(result.type).toBe('send')
    })

    test('classifies native ETH receive to user', () => {
      const tx = makeTx({ from: OTHER, to: USER, value: '1000000000000000000' })
      const result = parseEvmTransaction(tx, USER, 'ethereum')
      expect(result.type).toBe('receive')
    })

    test('classifies token send', () => {
      const tx = makeTx({
        from: USER,
        to: USDC_CONTRACT,
        tokenTransfers: [makeTokenTransfer({ from: USER, to: OTHER })],
      })
      const result = parseEvmTransaction(tx, USER, 'ethereum')
      expect(result.type).toBe('send')
    })

    test('classifies token receive', () => {
      const tx = makeTx({
        from: OTHER,
        to: USDC_CONTRACT,
        tokenTransfers: [makeTokenTransfer({ from: OTHER, to: USER })],
      })
      const result = parseEvmTransaction(tx, USER, 'ethereum')
      expect(result.type).toBe('receive')
    })

    test('classifies swap when user sends one token and receives another', () => {
      const tx = makeTx({
        from: USER,
        to: ROUTER,
        tokenTransfers: [
          makeTokenTransfer({ contract: USDC_CONTRACT, symbol: 'USDC', from: USER, to: ROUTER, value: '1000000' }),
          makeTokenTransfer({
            contract: DAI_CONTRACT,
            symbol: 'DAI',
            decimals: 18,
            from: ROUTER,
            to: USER,
            value: '1000000000000000000',
          }),
        ],
      })
      const result = parseEvmTransaction(tx, USER, 'ethereum')
      expect(result.type).toBe('swap')
    })

    test('classifies swap when user sends native ETH and receives token', () => {
      const tx = makeTx({
        from: USER,
        to: ROUTER,
        value: '1000000000000000000',
        tokenTransfers: [
          makeTokenTransfer({ contract: USDC_CONTRACT, symbol: 'USDC', from: ROUTER, to: USER, value: '2000000000' }),
        ],
      })
      const result = parseEvmTransaction(tx, USER, 'ethereum')
      expect(result.type).toBe('swap')
    })

    test('classifies contract interaction with input data to non-user address', () => {
      const tx = makeTx({ from: USER, to: ROUTER, inputData: '0xabcdef12' })
      const result = parseEvmTransaction(tx, USER, 'ethereum')
      expect(result.type).toBe('contract')
    })

    test('classifies as receive when to is user and no input data', () => {
      const tx = makeTx({ from: OTHER, to: USER })
      const result = parseEvmTransaction(tx, USER, 'ethereum')
      expect(result.type).toBe('receive')
    })

    test('classifies as send when from is user and no input data, no value', () => {
      const tx = makeTx({ from: USER, to: OTHER })
      const result = parseEvmTransaction(tx, USER, 'ethereum')
      expect(result.type).toBe('send')
    })

    test('handles case-insensitive address comparison', () => {
      const tx = makeTx({ from: USER.toLowerCase(), to: OTHER.toUpperCase(), value: '1000000000000000000' })
      const result = parseEvmTransaction(tx, USER.toUpperCase(), 'ethereum')
      expect(result.type).toBe('send')
    })

    test('falls back to contract for unknown pattern', () => {
      // from and to are both non-user addresses
      const tx = makeTx({ from: OTHER, to: ROUTER, inputData: '0x1234' })
      const result = parseEvmTransaction(tx, USER, 'ethereum')
      expect(result.type).toBe('contract')
    })
  })

  describe('net token transfer calculations', () => {
    test('nets out intermediate transfers in multi-hop swap', () => {
      // User sends USDC, intermediate contract bounces WETH, user receives DAI
      // USDC: user -> router (sent)
      // WETH: router -> pool (not user-involved, ignored)
      // DAI: pool -> user (received)
      const tx = makeTx({
        from: USER,
        to: ROUTER,
        tokenTransfers: [
          makeTokenTransfer({ contract: USDC_CONTRACT, symbol: 'USDC', from: USER, to: ROUTER, value: '1000000' }),
          makeTokenTransfer({
            contract: WETH_CONTRACT,
            symbol: 'WETH',
            decimals: 18,
            from: ROUTER,
            to: '0xPool',
            value: '500000000000000000',
          }),
          makeTokenTransfer({
            contract: DAI_CONTRACT,
            symbol: 'DAI',
            decimals: 18,
            from: '0xPool',
            to: USER,
            value: '999000000000000000',
          }),
        ],
      })
      const result = parseEvmTransaction(tx, USER, 'ethereum')
      expect(result.type).toBe('swap')
      expect(result.tokenTransfers).toHaveLength(2)
      // Negative (sent) should come first due to sorting
      expect(result.tokenTransfers![0].symbol).toBe('USDC')
      expect(result.tokenTransfers![1].symbol).toBe('DAI')
    })

    test('cancels out token that user both sends and receives equally', () => {
      // User sends 100 USDC and receives 100 USDC back (net zero), but also receives DAI
      const tx = makeTx({
        from: USER,
        to: ROUTER,
        tokenTransfers: [
          makeTokenTransfer({ contract: USDC_CONTRACT, symbol: 'USDC', from: USER, to: ROUTER, value: '100000000' }),
          makeTokenTransfer({ contract: USDC_CONTRACT, symbol: 'USDC', from: ROUTER, to: USER, value: '100000000' }),
          makeTokenTransfer({
            contract: DAI_CONTRACT,
            symbol: 'DAI',
            decimals: 18,
            from: ROUTER,
            to: USER,
            value: '100000000000000000000',
          }),
        ],
      })
      const result = parseEvmTransaction(tx, USER, 'ethereum')
      // USDC nets to zero so only DAI remains — that's a receive, not a swap
      expect(result.type).toBe('receive')
    })

    test('computes correct net when same token has multiple sends and receives', () => {
      // User sends 300 USDC across two transfers, receives 100 back — net -200
      // Also receives DAI — net positive
      const tx = makeTx({
        from: USER,
        to: ROUTER,
        tokenTransfers: [
          makeTokenTransfer({ contract: USDC_CONTRACT, symbol: 'USDC', from: USER, to: ROUTER, value: '200000000' }),
          makeTokenTransfer({ contract: USDC_CONTRACT, symbol: 'USDC', from: USER, to: '0xPool', value: '100000000' }),
          makeTokenTransfer({ contract: USDC_CONTRACT, symbol: 'USDC', from: '0xPool', to: USER, value: '100000000' }),
          makeTokenTransfer({
            contract: DAI_CONTRACT,
            symbol: 'DAI',
            decimals: 18,
            from: ROUTER,
            to: USER,
            value: '200000000000000000000',
          }),
        ],
      })
      const result = parseEvmTransaction(tx, USER, 'ethereum')
      expect(result.type).toBe('swap')
      expect(result.tokenTransfers).toHaveLength(2)
      // Negative first
      const usdcTransfer = result.tokenTransfers!.find(t => t.symbol === 'USDC')!
      expect(parseFloat(usdcTransfer.amount)).toBeLessThan(0)
    })
  })

  describe('swap token transfer ordering', () => {
    test('sorts negative (sent) amounts before positive (received)', () => {
      const tx = makeTx({
        from: USER,
        to: ROUTER,
        tokenTransfers: [
          makeTokenTransfer({
            contract: DAI_CONTRACT,
            symbol: 'DAI',
            decimals: 18,
            from: ROUTER,
            to: USER,
            value: '1000000000000000000',
          }),
          makeTokenTransfer({ contract: USDC_CONTRACT, symbol: 'USDC', from: USER, to: ROUTER, value: '1000000' }),
        ],
      })
      const result = parseEvmTransaction(tx, USER, 'ethereum')
      expect(result.type).toBe('swap')
      expect(parseFloat(result.tokenTransfers![0].amount)).toBeLessThan(0)
      expect(parseFloat(result.tokenTransfers![1].amount)).toBeGreaterThan(0)
    })

    test('sets from/to correctly for swap token transfers', () => {
      const tx = makeTx({
        from: USER,
        to: ROUTER,
        tokenTransfers: [
          makeTokenTransfer({ contract: USDC_CONTRACT, symbol: 'USDC', from: USER, to: ROUTER, value: '1000000' }),
          makeTokenTransfer({
            contract: DAI_CONTRACT,
            symbol: 'DAI',
            decimals: 18,
            from: ROUTER,
            to: USER,
            value: '1000000000000000000',
          }),
        ],
      })
      const result = parseEvmTransaction(tx, USER, 'ethereum')
      // Sent token: from should be user address
      expect(result.tokenTransfers![0].from).toBe(USER)
      // Received token: to should be user address
      expect(result.tokenTransfers![1].to).toBe(USER)
    })
  })

  describe('native value + token transfers (swap with ETH)', () => {
    test('prepends native ETH transfer when user sends ETH and receives token', () => {
      const tx = makeTx({
        from: USER,
        to: ROUTER,
        value: '1000000000000000000',
        tokenTransfers: [
          makeTokenTransfer({ contract: USDC_CONTRACT, symbol: 'USDC', from: ROUTER, to: USER, value: '2000000000' }),
        ],
      })
      const result = parseEvmTransaction(tx, USER, 'ethereum')
      expect(result.type).toBe('swap')
      // ETH should be first (prepended native)
      expect(result.tokenTransfers![0].symbol).toBe('ETH')
      expect(result.tokenTransfers![0].assetId).toBe('eip155:1/slip44:60')
      expect(parseFloat(result.tokenTransfers![0].amount)).toBeGreaterThan(0) // native value shown as positive
      // USDC second
      expect(result.tokenTransfers![1].symbol).toBe('USDC')
    })

    test('does not prepend native ETH when user already has negative token transfer', () => {
      // User sends USDC, receives DAI, and also sends some native ETH — but the token send covers the "negative" side
      const tx = makeTx({
        from: USER,
        to: ROUTER,
        value: '100000000000000000',
        tokenTransfers: [
          makeTokenTransfer({ contract: USDC_CONTRACT, symbol: 'USDC', from: USER, to: ROUTER, value: '1000000' }),
          makeTokenTransfer({
            contract: DAI_CONTRACT,
            symbol: 'DAI',
            decimals: 18,
            from: ROUTER,
            to: USER,
            value: '1000000000000000000',
          }),
        ],
      })
      const result = parseEvmTransaction(tx, USER, 'ethereum')
      expect(result.type).toBe('swap')
      // Should NOT have ETH as first transfer since there's already a negative token
      expect(result.tokenTransfers!.find(t => t.symbol === 'ETH')).toBeUndefined()
    })
  })

  describe('zero-value transactions', () => {
    test('zero ETH value with contract interaction is classified as contract', () => {
      const tx = makeTx({ from: USER, to: ROUTER, value: '0', inputData: '0xdeadbeef' })
      const result = parseEvmTransaction(tx, USER, 'ethereum')
      expect(result.type).toBe('contract')
    })

    test('zero ETH value with token transfer is classified by token direction', () => {
      const tx = makeTx({
        from: USER,
        to: USDC_CONTRACT,
        value: '0',
        tokenTransfers: [makeTokenTransfer({ from: USER, to: OTHER })],
      })
      const result = parseEvmTransaction(tx, USER, 'ethereum')
      expect(result.type).toBe('send')
    })
  })

  describe('base transaction fields', () => {
    test('converts status 1 to success', () => {
      const result = parseEvmTransaction(makeTx({ status: 1 }), USER, 'ethereum')
      expect(result.status).toBe('success')
    })

    test('converts non-1 status to failed', () => {
      const result = parseEvmTransaction(makeTx({ status: 0 }), USER, 'ethereum')
      expect(result.status).toBe('failed')
    })

    test('converts fee from wei to ETH', () => {
      const tx = makeTx({ fee: '21000000000000' }) // 0.000021 ETH
      const result = parseEvmTransaction(tx, USER, 'ethereum')
      expect(parseFloat(result.fee)).toBeCloseTo(0.000021, 6)
    })

    test('converts value from wei to ETH', () => {
      const tx = makeTx({ value: '1500000000000000000' }) // 1.5 ETH
      const result = parseEvmTransaction(tx, USER, 'ethereum')
      expect(parseFloat(result.value)).toBeCloseTo(1.5, 6)
    })

    test('preserves txid, timestamp, blockHeight, from, to', () => {
      const tx = makeTx({ txid: '0xdeadbeef', timestamp: 999, blockHeight: 42, from: USER, to: OTHER })
      const result = parseEvmTransaction(tx, USER, 'ethereum')
      expect(result.txid).toBe('0xdeadbeef')
      expect(result.timestamp).toBe(999)
      expect(result.blockHeight).toBe(42)
      expect(result.from).toBe(USER)
      expect(result.to).toBe(OTHER)
    })
  })

  describe('non-swap token transfers', () => {
    test('filters out transfers not involving the user', () => {
      const tx = makeTx({
        from: OTHER,
        to: USER,
        tokenTransfers: [
          makeTokenTransfer({ from: OTHER, to: USER, value: '500000' }),
          makeTokenTransfer({ from: ROUTER, to: '0xPool', value: '999999' }), // not user-involved
        ],
      })
      const result = parseEvmTransaction(tx, USER, 'ethereum')
      expect(result.tokenTransfers).toHaveLength(1)
      expect(result.tokenTransfers![0].from).toBe(OTHER)
    })

    test('returns undefined tokenTransfers when no user-involved transfers', () => {
      const tx = makeTx({
        from: OTHER,
        to: USER,
        tokenTransfers: [makeTokenTransfer({ from: ROUTER, to: '0xPool', value: '1000000' })],
      })
      const result = parseEvmTransaction(tx, USER, 'ethereum')
      expect(result.tokenTransfers).toBeUndefined()
    })

    test('returns undefined tokenTransfers when no token transfers at all', () => {
      const tx = makeTx({ from: USER, to: OTHER, value: '1000000000000000000' })
      const result = parseEvmTransaction(tx, USER, 'ethereum')
      expect(result.tokenTransfers).toBeUndefined()
    })
  })

  describe('network handling', () => {
    test('produces correct assetId for different networks', () => {
      const tx = makeTx({
        from: USER,
        to: ROUTER,
        tokenTransfers: [
          makeTokenTransfer({ contract: USDC_CONTRACT, symbol: 'USDC', from: USER, to: ROUTER, value: '1000000' }),
          makeTokenTransfer({
            contract: DAI_CONTRACT,
            symbol: 'DAI',
            decimals: 18,
            from: ROUTER,
            to: USER,
            value: '1000000000000000000',
          }),
        ],
      })

      const ethResult = parseEvmTransaction(tx, USER, 'ethereum')
      expect(ethResult.tokenTransfers![0].assetId).toContain('eip155:1/')

      const arbResult = parseEvmTransaction(tx, USER, 'arbitrum')
      expect(arbResult.tokenTransfers![0].assetId).toContain('eip155:42161/')
    })
  })

  describe('internalTxs classification', () => {
    test('classifies as swap when user sends token and receives native via internal call', () => {
      const tx = makeTx({
        from: USER,
        to: ROUTER,
        value: '0',
        tokenTransfers: [
          makeTokenTransfer({ contract: USDC_CONTRACT, symbol: 'USDC', from: USER, to: ROUTER, value: '2000000000' }),
        ],
        internalTxs: [{ from: ROUTER, to: USER, value: '1000000000000000000' }],
      })
      const result = parseEvmTransaction(tx, USER, 'ethereum')
      expect(result.type).toBe('swap')
      expect(result.tokenTransfers!.length).toBe(2)
      const ethTransfer = result.tokenTransfers!.find(t => t.symbol === 'ETH')
      expect(ethTransfer).toBeDefined()
      expect(parseFloat(ethTransfer!.amount)).toBeGreaterThan(0)
    })

    test('classifies as swap when user sends native via internal call and receives token', () => {
      const tx = makeTx({
        from: USER,
        to: ROUTER,
        value: '0',
        tokenTransfers: [
          makeTokenTransfer({
            contract: DAI_CONTRACT,
            symbol: 'DAI',
            decimals: 18,
            from: ROUTER,
            to: USER,
            value: '1000000000000000000',
          }),
        ],
        internalTxs: [{ from: USER, to: ROUTER, value: '500000000000000000' }],
      })
      const result = parseEvmTransaction(tx, USER, 'ethereum')
      expect(result.type).toBe('swap')
      const ethTransfer = result.tokenTransfers!.find(t => t.symbol === 'ETH')
      expect(ethTransfer).toBeDefined()
      expect(parseFloat(ethTransfer!.amount)).toBeLessThan(0)
    })

    test('does not double-count when tx.value already covers native transfer', () => {
      const tx = makeTx({
        from: USER,
        to: ROUTER,
        value: '1000000000000000000',
        tokenTransfers: [
          makeTokenTransfer({ contract: USDC_CONTRACT, symbol: 'USDC', from: ROUTER, to: USER, value: '2000000000' }),
        ],
        internalTxs: [],
      })
      const result = parseEvmTransaction(tx, USER, 'ethereum')
      expect(result.type).toBe('swap')
      const ethTransfers = result.tokenTransfers!.filter(t => t.symbol === 'ETH')
      expect(ethTransfers).toHaveLength(1)
    })
  })

  describe('decimals fallback', () => {
    test('uses PRECISION_HIGH (18) when decimals is undefined', () => {
      const tx = makeTx({
        from: USER,
        to: ROUTER,
        tokenTransfers: [
          makeTokenTransfer({
            contract: USDC_CONTRACT,
            symbol: 'USDC',
            decimals: undefined,
            from: USER,
            to: ROUTER,
            value: '1000000000000000000',
          }),
          makeTokenTransfer({
            contract: DAI_CONTRACT,
            symbol: 'DAI',
            decimals: undefined,
            from: ROUTER,
            to: USER,
            value: '2000000000000000000',
          }),
        ],
      })
      const result = parseEvmTransaction(tx, USER, 'ethereum')
      expect(result.type).toBe('swap')
      // With 18 decimals, 1e18 wei = 1.0
      expect(parseFloat(result.tokenTransfers![0].amount)).toBeCloseTo(-1, 6)
      expect(result.tokenTransfers![0].decimals).toBe(18)
    })
  })
})
