import type { Hex, PublicClient } from 'viem'

import { extractRevertReason, isRevertError, SimulationError } from '@/utils/SimulationError'

const GAS_BUFFER_PERCENT = 20n

type SimulateParams = {
  account: `0x${string}`
  to: `0x${string}`
  value: bigint
  data: Hex
}

export async function simulateEvmTransaction(publicClient: PublicClient, params: SimulateParams): Promise<bigint> {
  // Detect reverts via eth_call
  try {
    await publicClient.call(params)
  } catch (error) {
    if (isRevertError(error)) throw new SimulationError(extractRevertReason(error))
    throw error
  }

  // Get accurate gas estimate
  const gasEstimate = await publicClient.estimateGas(params)
  return gasEstimate + (gasEstimate * GAS_BUFFER_PERCENT) / 100n
}
