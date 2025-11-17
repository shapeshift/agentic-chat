import type { ParsedTransaction } from '@shapeshiftoss/types'
import { describe, expect, test } from 'bun:test'

import type { PriceMap } from '../pricing'
import { calculateUsdValues } from '../usdCalculator'

describe('USD Calculator', () => {
  const priceMap: PriceMap = new Map([
    ['eip155:1/slip44:60', 3000], // ETH price
    ['eip155:1/erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 1], // USDC price
    ['eip155:1/erc20:0x6b175474e89094c44da98b954eedeac495271d0f', 1], // DAI price
  ])

  test('calculates USD values for send transaction', () => {
    const transactions: ParsedTransaction[] = [
      {
        txid: 'tx1',
        timestamp: 1704067200,
        blockHeight: 100,
        status: 'success',
        type: 'send',
        value: '1.0', // 1 ETH
        fee: '0.01', // 0.01 ETH
        from: '0x123',
        to: '0x456',
        network: 'ethereum',
      },
    ]

    const result = calculateUsdValues(transactions, priceMap)

    expect(result[0]?.usdValueSent).toBe(3000) // 1 ETH × $3000
    expect(result[0]?.usdValueReceived).toBeUndefined()
    expect(result[0]?.usdFee).toBe(30) // 0.01 ETH × $3000
  })

  test('calculates USD values for receive transaction', () => {
    const transactions: ParsedTransaction[] = [
      {
        txid: 'tx2',
        timestamp: 1704067200,
        blockHeight: 100,
        status: 'success',
        type: 'receive',
        value: '2.5', // 2.5 ETH
        fee: '0.005', // 0.005 ETH
        from: '0x456',
        to: '0x123',
        network: 'ethereum',
      },
    ]

    const result = calculateUsdValues(transactions, priceMap)

    expect(result[0]?.usdValueSent).toBeUndefined()
    expect(result[0]?.usdValueReceived).toBe(7500) // 2.5 ETH × $3000
    expect(result[0]?.usdFee).toBe(15) // 0.005 ETH × $3000
  })

  test('calculates USD values for swap transaction', () => {
    const transactions: ParsedTransaction[] = [
      {
        txid: 'tx3',
        timestamp: 1704067200,
        blockHeight: 100,
        status: 'success',
        type: 'swap',
        value: '0',
        fee: '0.02', // 0.02 ETH
        from: '0x123',
        to: '0x456',
        network: 'ethereum',
        tokenTransfers: [
          {
            symbol: 'ETH',
            amount: '-1.0', // Sold 1 ETH
            decimals: 18,
            from: '0x123',
            to: '0x456',
            assetId: 'eip155:1/slip44:60',
          },
          {
            symbol: 'USDC',
            amount: '2900', // Bought 2900 USDC
            decimals: 6,
            from: '0x456',
            to: '0x123',
            assetId: 'eip155:1/erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          },
        ],
      },
    ]

    const result = calculateUsdValues(transactions, priceMap)

    expect(result[0]?.usdValueSent).toBe(3000) // 1 ETH × $3000
    expect(result[0]?.usdValueReceived).toBe(2900) // 2900 USDC × $1
    expect(result[0]?.usdFee).toBe(60) // 0.02 ETH × $3000
  })

  test('calculates USD values for contract transaction', () => {
    const transactions: ParsedTransaction[] = [
      {
        txid: 'tx4',
        timestamp: 1704067200,
        blockHeight: 100,
        status: 'success',
        type: 'contract',
        value: '0',
        fee: '0.015', // 0.015 ETH
        from: '0x123',
        to: '0x456',
        network: 'ethereum',
        tokenTransfers: [
          {
            symbol: 'USDC',
            amount: '-1000', // Sent 1000 USDC
            decimals: 6,
            from: '0x123',
            to: '0x456',
            assetId: 'eip155:1/erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          },
          {
            symbol: 'DAI',
            amount: '1000', // Received 1000 DAI
            decimals: 18,
            from: '0x456',
            to: '0x123',
            assetId: 'eip155:1/erc20:0x6b175474e89094c44da98b954eedeac495271d0f',
          },
        ],
      },
    ]

    const result = calculateUsdValues(transactions, priceMap)

    expect(result[0]?.usdValueSent).toBe(1000) // 1000 USDC × $1
    expect(result[0]?.usdValueReceived).toBe(1000) // 1000 DAI × $1
    expect(result[0]?.usdFee).toBe(45) // 0.015 ETH × $3000
  })

  test('handles missing prices gracefully', () => {
    const emptyPriceMap: PriceMap = new Map()
    const transactions: ParsedTransaction[] = [
      {
        txid: 'tx1',
        timestamp: 1704067200,
        blockHeight: 100,
        status: 'success',
        type: 'send',
        value: '1.0',
        fee: '0.01',
        from: '0x123',
        to: '0x456',
        network: 'ethereum',
      },
    ]

    const result = calculateUsdValues(transactions, emptyPriceMap)

    expect(result[0]?.usdValueSent).toBeUndefined()
    expect(result[0]?.usdValueReceived).toBeUndefined()
    expect(result[0]?.usdFee).toBeUndefined()
  })

  test('handles missing network gracefully', () => {
    const transactions: ParsedTransaction[] = [
      {
        txid: 'tx1',
        timestamp: 1704067200,
        blockHeight: 100,
        status: 'success',
        type: 'send',
        value: '1.0',
        fee: '0.01',
        from: '0x123',
        to: '0x456',
      },
    ]

    const result = calculateUsdValues(transactions, priceMap)

    expect(result[0]?.usdValueSent).toBeUndefined()
    expect(result[0]?.usdValueReceived).toBeUndefined()
    expect(result[0]?.usdFee).toBeUndefined()
  })

  test('calculates USD values for ERC20 token send', () => {
    const transactions: ParsedTransaction[] = [
      {
        txid: 'tx5',
        timestamp: 1704067200,
        blockHeight: 100,
        status: 'success',
        type: 'send',
        value: '0', // No native token sent
        fee: '0.01', // 0.01 ETH fee
        from: '0x123',
        to: '0x456',
        network: 'ethereum',
        tokenTransfers: [
          {
            symbol: 'USDC',
            amount: '1000', // Sent 1000 USDC
            decimals: 6,
            from: '0x123',
            to: '0x456',
            assetId: 'eip155:1/erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          },
        ],
      },
    ]

    const result = calculateUsdValues(transactions, priceMap)

    expect(result[0]?.usdValueSent).toBe(1000) // 1000 USDC × $1
    expect(result[0]?.usdValueReceived).toBeUndefined()
    expect(result[0]?.usdFee).toBe(30) // 0.01 ETH × $3000
  })

  test('calculates USD values for ERC20 token receive', () => {
    const transactions: ParsedTransaction[] = [
      {
        txid: 'tx6',
        timestamp: 1704067200,
        blockHeight: 100,
        status: 'success',
        type: 'receive',
        value: '0', // No native token received
        fee: '0.01', // 0.01 ETH fee
        from: '0x456',
        to: '0x123',
        network: 'ethereum',
        tokenTransfers: [
          {
            symbol: 'DAI',
            amount: '500', // Received 500 DAI
            decimals: 18,
            from: '0x456',
            to: '0x123',
            assetId: 'eip155:1/erc20:0x6b175474e89094c44da98b954eedeac495271d0f',
          },
        ],
      },
    ]

    const result = calculateUsdValues(transactions, priceMap)

    expect(result[0]?.usdValueSent).toBeUndefined()
    expect(result[0]?.usdValueReceived).toBe(500) // 500 DAI × $1
    expect(result[0]?.usdFee).toBe(30) // 0.01 ETH × $3000
  })

  test('handles swap with multiple token transfers', () => {
    const transactions: ParsedTransaction[] = [
      {
        txid: 'tx3',
        timestamp: 1704067200,
        blockHeight: 100,
        status: 'success',
        type: 'swap',
        value: '0',
        fee: '0.02',
        from: '0x123',
        to: '0x456',
        network: 'ethereum',
        tokenTransfers: [
          {
            symbol: 'ETH',
            amount: '-0.5',
            decimals: 18,
            from: '0x123',
            to: '0x456',
            assetId: 'eip155:1/slip44:60',
          },
          {
            symbol: 'USDC',
            amount: '-500',
            decimals: 6,
            from: '0x123',
            to: '0x456',
            assetId: 'eip155:1/erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          },
          {
            symbol: 'DAI',
            amount: '2000',
            decimals: 18,
            from: '0x456',
            to: '0x123',
            assetId: 'eip155:1/erc20:0x6b175474e89094c44da98b954eedeac495271d0f',
          },
        ],
      },
    ]

    const result = calculateUsdValues(transactions, priceMap)

    // Sent: 0.5 ETH ($1500) + 500 USDC ($500) = $2000
    expect(result[0]?.usdValueSent).toBe(2000)
    // Received: 2000 DAI ($2000)
    expect(result[0]?.usdValueReceived).toBe(2000)
  })
})
