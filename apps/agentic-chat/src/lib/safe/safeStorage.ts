// localStorage-based cache for Safe deployment state, keyed by embedded wallet address

const STORAGE_KEY_PREFIX = 'safe_deployment_'

interface SafeChainState {
  safeAddress: string
  isDeployed: boolean
  modulesEnabled: boolean
}

export type SafeDeploymentState = Record<number, SafeChainState>

function getStorageKey(ownerAddress: string): string {
  return `${STORAGE_KEY_PREFIX}${ownerAddress.toLowerCase()}`
}

export function getSafeState(ownerAddress: string): SafeDeploymentState {
  try {
    const raw = localStorage.getItem(getStorageKey(ownerAddress))
    if (!raw) return {}
    return JSON.parse(raw) as SafeDeploymentState
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
