import { describe, expect, it } from 'bun:test'

import { SimulationError } from '@/utils/SimulationError'

import { simulateEvmTransaction } from '../simulation'

function mockPublicClient(overrides: {
  callResult?: undefined
  callError?: Error
  gasEstimate?: bigint
  gasError?: Error
}) {
  return {
    call: async () => {
      if (overrides.callError) throw overrides.callError
      return overrides.callResult
    },
    estimateGas: async () => {
      if (overrides.gasError) throw overrides.gasError
      return overrides.gasEstimate ?? 21000n
    },
  } as any
}

const defaultParams = {
  account: '0x1234567890abcdef1234567890abcdef12345678' as const,
  to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as const,
  value: 0n,
  data: '0x' as const,
}

describe('simulateEvmTransaction', () => {
  it('throws SimulationError when call reverts', async () => {
    const revertErr = new Error('execution reverted: insufficient balance') as Error & { shortMessage: string }
    revertErr.shortMessage = 'insufficient balance'
    const client = mockPublicClient({ callError: revertErr })

    expect(simulateEvmTransaction(client, defaultParams)).rejects.toBeInstanceOf(SimulationError)
  })

  it('includes revert reason in SimulationError message', async () => {
    const revertErr = new Error('execution reverted: insufficient balance') as Error & { shortMessage: string }
    revertErr.shortMessage = 'insufficient balance'
    const client = mockPublicClient({ callError: revertErr })

    try {
      await simulateEvmTransaction(client, defaultParams)
      expect(true).toBe(false) // should not reach
    } catch (error) {
      expect(error).toBeInstanceOf(SimulationError)
      expect((error as Error).message).toBe('insufficient balance')
    }
  })

  it('re-throws non-revert errors from call', async () => {
    const networkErr = new Error('network timeout')
    const client = mockPublicClient({ callError: networkErr })

    expect(simulateEvmTransaction(client, defaultParams)).rejects.toThrow('network timeout')
    try {
      await simulateEvmTransaction(client, defaultParams)
    } catch (error) {
      expect(error).not.toBeInstanceOf(SimulationError)
    }
  })

  it('returns gas estimate with 20% buffer on success', async () => {
    const client = mockPublicClient({ gasEstimate: 100000n })
    const result = await simulateEvmTransaction(client, defaultParams)
    expect(result).toBe(120000n) // 100000 + 20%
  })

  it('applies buffer correctly for non-round gas values', async () => {
    const client = mockPublicClient({ gasEstimate: 21000n })
    const result = await simulateEvmTransaction(client, defaultParams)
    // 21000 + (21000 * 20 / 100) = 21000 + 4200 = 25200
    expect(result).toBe(25200n)
  })
})
