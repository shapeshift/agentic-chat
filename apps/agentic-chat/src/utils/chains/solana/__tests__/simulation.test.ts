import { describe, expect, it } from 'bun:test'

import { SimulationError } from '@/utils/SimulationError'

import { simulateSolanaTransaction } from '../simulation'

function mockConnection(result: { err: unknown; logs: string[] | null }) {
  return {
    simulateTransaction: async () => ({ value: result }),
  } as any
}

const tx = {} as any

describe('simulateSolanaTransaction', () => {
  it('returns void on successful simulation', async () => {
    const connection = mockConnection({ err: null, logs: [] })
    const result = await simulateSolanaTransaction(tx, connection)
    expect(result).toBeUndefined()
  })

  it('throws SimulationError with matching log line on error', async () => {
    const connection = mockConnection({
      err: { InstructionError: [0, 'Custom'] },
      logs: ['Program log: some info', 'Program log: Error: insufficient funds', 'Program log: cleanup'],
    })

    try {
      await simulateSolanaTransaction(tx, connection)
      expect(true).toBe(false)
    } catch (error) {
      expect(error).toBeInstanceOf(SimulationError)
      expect((error as Error).message).toInclude('Error')
    }
  })

  it('throws SimulationError with "failed" log line', async () => {
    const connection = mockConnection({
      err: { InstructionError: [0, 'Custom'] },
      logs: ['Program log: transaction failed due to slippage'],
    })

    try {
      await simulateSolanaTransaction(tx, connection)
      expect(true).toBe(false)
    } catch (error) {
      expect(error).toBeInstanceOf(SimulationError)
      expect((error as Error).message).toInclude('failed')
    }
  })

  it('falls back to JSON-stringified error when no matching log', async () => {
    const errObj = { InstructionError: [0, 'Custom'] }
    const connection = mockConnection({
      err: errObj,
      logs: ['Program log: some benign info'],
    })

    try {
      await simulateSolanaTransaction(tx, connection)
      expect(true).toBe(false)
    } catch (error) {
      expect(error).toBeInstanceOf(SimulationError)
      expect((error as Error).message).toBe(JSON.stringify(errObj))
    }
  })

  it('falls back to JSON-stringified error when logs are null', async () => {
    const errObj = { InstructionError: [0, 'Custom'] }
    const connection = mockConnection({ err: errObj, logs: null })

    try {
      await simulateSolanaTransaction(tx, connection)
      expect(true).toBe(false)
    } catch (error) {
      expect(error).toBeInstanceOf(SimulationError)
      expect((error as Error).message).toBe(JSON.stringify(errObj))
    }
  })
})
