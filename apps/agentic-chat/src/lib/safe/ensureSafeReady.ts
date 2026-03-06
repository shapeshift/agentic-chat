import { deploySafe } from './safeFactory'
import { enableComposableCowModules, ModulesAlreadyEnabledError } from './safeModules'
import type { SafeProvider } from './types'

export async function ensureSafeReady(
  ownerAddress: string,
  chainId: number,
  signerAddress: string,
  provider: SafeProvider
): Promise<string> {
  const deployResult = await deploySafe(ownerAddress, chainId, signerAddress, provider)
  if (!deployResult.isDeployed) throw new Error('Failed to deploy Safe smart account')

  try {
    await enableComposableCowModules(deployResult.safeAddress, chainId, signerAddress, provider)
  } catch (error) {
    if (!(error instanceof ModulesAlreadyEnabledError)) throw error
  }

  return deployResult.safeAddress
}
