// localStorage-based cache for Safe deployment state, keyed by wallet address
import { z } from 'zod'

const STORAGE_KEY_PREFIX = 'safe_deployment_'

const SafeChainStateSchema = z.object({
  safeAddress: z.string(),
  isDeployed: z.boolean(),
  modulesEnabled: z.boolean(),
  domainVerifierSet: z.boolean(),
})

const SafeDeploymentStateSchema = z
  .record(z.string(), SafeChainStateSchema)
  .transform(
    rec => Object.fromEntries(Object.entries(rec).map(([k, v]) => [Number(k), v])) as Record<number, SafeChainState>
  )

type SafeChainState = z.infer<typeof SafeChainStateSchema>
export type SafeDeploymentState = Record<number, SafeChainState>

function getStorageKey(ownerAddress: string): string {
  return `${STORAGE_KEY_PREFIX}${ownerAddress.toLowerCase()}`
}

export function getSafeState(ownerAddress: string): SafeDeploymentState {
  try {
    const raw = localStorage.getItem(getStorageKey(ownerAddress))
    if (!raw) return {}
    return SafeDeploymentStateSchema.parse(JSON.parse(raw))
  } catch {
    return {}
  }
}

export function setSafeState(ownerAddress: string, chainId: number, state: SafeChainState): void {
  const current = getSafeState(ownerAddress)
  current[chainId] = state
  localStorage.setItem(getStorageKey(ownerAddress), JSON.stringify(current))
}

export function getSafeAddress(ownerAddress: string, chainId: number): string | undefined {
  return getSafeState(ownerAddress)[chainId]?.safeAddress
}

export function isSafeDeployedOnChain(ownerAddress: string, chainId: number): boolean {
  return getSafeState(ownerAddress)[chainId]?.isDeployed ?? false
}

export function areModulesEnabledOnChain(ownerAddress: string, chainId: number): boolean {
  return getSafeState(ownerAddress)[chainId]?.modulesEnabled ?? false
}

export function isDomainVerifierSetOnChain(ownerAddress: string, chainId: number): boolean {
  return getSafeState(ownerAddress)[chainId]?.domainVerifierSet ?? false
}
