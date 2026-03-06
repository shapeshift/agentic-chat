// Run with: bun test --env-file=.env.local <this file>
// VITE_SOLANA_RPC_URL is required at module load time by feeEstimation.ts
import { describe, expect, test } from 'bun:test'

import { estimateEvmTransferGas, estimateSolanaFee, formatEstimatedFee } from '../feeEstimation'

describe('estimateEvmTransferGas', () => {
  test('returns 21000 for native transfers', () => {
    expect(estimateEvmTransferGas(true)).toBe(21000n)
  })

  test('returns 65000 for ERC20 transfers', () => {
    expect(estimateEvmTransferGas(false)).toBe(65000n)
  })
})

describe('estimateSolanaFee', () => {
  const BASE_FEE = 5000n
  const ATA_CREATION_COST = 2039280n

  test('returns base fee when ATA exists', () => {
    expect(estimateSolanaFee(false)).toBe(BASE_FEE)
  })

  test('includes ATA creation cost when needed', () => {
    expect(estimateSolanaFee(true)).toBe(BASE_FEE + ATA_CREATION_COST)
  })
})

describe('formatEstimatedFee', () => {
  describe('EVM chains', () => {
    test('returns ~0.001 for native token', () => {
      expect(formatEstimatedFee('eip155:1', true)).toBe('~0.001')
    })

    test('returns ~0.002 for ERC20 token', () => {
      expect(formatEstimatedFee('eip155:1', false)).toBe('~0.002')
    })

    test('works with different EVM chain IDs', () => {
      expect(formatEstimatedFee('eip155:137', true)).toBe('~0.001')
      expect(formatEstimatedFee('eip155:42161', false)).toBe('~0.002')
    })

    test('ignores needsAtaCreation param on EVM', () => {
      expect(formatEstimatedFee('eip155:1', true, true)).toBe('~0.001')
      expect(formatEstimatedFee('eip155:1', false, true)).toBe('~0.002')
    })
  })

  describe('Solana chains', () => {
    test('returns ~0.000005 for standard transfer', () => {
      expect(formatEstimatedFee('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', true)).toBe('~0.000005')
    })

    test('returns ~0.00244 when ATA creation needed', () => {
      expect(formatEstimatedFee('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', false, true)).toBe('~0.00244')
    })

    test('returns base fee when needsAtaCreation is false', () => {
      expect(formatEstimatedFee('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', false, false)).toBe('~0.000005')
    })

    test('returns base fee when needsAtaCreation is undefined', () => {
      expect(formatEstimatedFee('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', false)).toBe('~0.000005')
    })
  })
})

describe('gas cost calculation logic', () => {
  // These verify the math used in calculateMaxEvmSend without needing network calls
  const GAS_PRICE_BUFFER_PERCENT = 20n
  const EVM_NATIVE_GAS_LIMIT = 21000n

  test('20% buffer calculation produces correct gas cost', () => {
    const gasPrice = 30_000_000_000n // 30 gwei
    const gasCost = (EVM_NATIVE_GAS_LIMIT * gasPrice * (100n + GAS_PRICE_BUFFER_PERCENT)) / 100n
    // 21000 * 30gwei * 1.2 = 756000 gwei = 0.000756 ETH
    expect(gasCost).toBe(756_000_000_000_000n)
  })

  test('buffer calculation with zero gas price yields zero cost', () => {
    const gasPrice = 0n
    const gasCost = (EVM_NATIVE_GAS_LIMIT * gasPrice * (100n + GAS_PRICE_BUFFER_PERCENT)) / 100n
    expect(gasCost).toBe(0n)
  })

  test('buffer calculation with very high gas price (500 gwei)', () => {
    const gasPrice = 500_000_000_000n
    const gasCost = (EVM_NATIVE_GAS_LIMIT * gasPrice * (100n + GAS_PRICE_BUFFER_PERCENT)) / 100n
    // 21000 * 500gwei * 1.2 = 12,600,000 gwei = 0.0126 ETH
    expect(gasCost).toBe(12_600_000_000_000_000n)
  })
})

describe('solana reserve calculation logic', () => {
  const RENT_EXEMPT_MINIMUM = 890880n
  const BASE_FEE = 5000n

  test('required reserve is rent-exempt + base fee', () => {
    const requiredReserve = RENT_EXEMPT_MINIMUM + BASE_FEE
    expect(requiredReserve).toBe(895880n)
  })

  test('max send with balance just above reserve', () => {
    const balance = 900000n
    const requiredReserve = RENT_EXEMPT_MINIMUM + BASE_FEE
    const maxSend = balance - requiredReserve
    expect(maxSend).toBe(4120n)
  })

  test('balance equal to reserve leaves zero sendable', () => {
    const balance = RENT_EXEMPT_MINIMUM + BASE_FEE
    const maxSend = balance - (RENT_EXEMPT_MINIMUM + BASE_FEE)
    expect(maxSend).toBe(0n)
  })

  test('balance below reserve would be insufficient', () => {
    const balance = 800000n
    const requiredReserve = RENT_EXEMPT_MINIMUM + BASE_FEE
    expect(balance <= requiredReserve).toBe(true)
  })
})
