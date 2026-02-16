import { isEthereumWallet } from '@dynamic-labs/ethereum'
import { useUserWallets } from '@dynamic-labs/sdk-react-core'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { deploySafe, enableComposableCowModules, getSafeState } from '@/lib/safe'
import type { SafeDeploymentResult } from '@/lib/safe'

export interface SafeChainDeployment {
  isDeployed: boolean
  modulesEnabled: boolean
  domainVerifierSet: boolean
  safeAddress: string
}

export interface UseSafeAccountResult {
  safeAddress: string | undefined
  isDeployed: boolean
  isModulesEnabled: boolean
  isSafeReady: boolean // deployed + modules enabled on any chain
  isDeploying: boolean
  deployedChainIds: number[]
  safeDeploymentState: Record<number, SafeChainDeployment>
  deploySafe: (chainId: number) => Promise<SafeDeploymentResult>
  enableModules: (chainId: number) => Promise<string>
}

export function useSafeAccount(): UseSafeAccountResult {
  // Get wallet info directly from Dynamic SDK to avoid circular dependency with useWalletConnection
  const userWallets = useUserWallets()
  const evmAddress = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- SDK type variance
    const evmWallet = userWallets.find(w => isEthereumWallet(w))
    return evmWallet?.address
  }, [userWallets])

  const [safeState, setSafeStateLocal] = useState<ReturnType<typeof getSafeState>>({})
  const [isDeploying, setIsDeploying] = useState(false)

  // Load Safe state from localStorage when address changes
  useEffect(() => {
    if (evmAddress) {
      setSafeStateLocal(getSafeState(evmAddress))
    } else {
      setSafeStateLocal({})
    }
  }, [evmAddress])

  // Check if Safe is deployed + modules enabled on any chain
  const deploymentInfo = useMemo(() => {
    const entries = Object.values(safeState)
    const deployed = entries.some(s => s.isDeployed)
    const modulesEnabled = entries.some(s => s.modulesEnabled && s.domainVerifierSet)
    const deployedChainIds = Object.entries(safeState)
      .filter(([, s]) => s.isDeployed)
      .map(([chainId]) => Number(chainId))

    const perChainState: Record<number, SafeChainDeployment> = {}
    for (const [chainId, state] of Object.entries(safeState)) {
      if (!state.safeAddress) continue
      perChainState[Number(chainId)] = {
        isDeployed: state.isDeployed,
        modulesEnabled: state.modulesEnabled,
        domainVerifierSet: state.domainVerifierSet,
        safeAddress: state.safeAddress,
      }
    }

    return { deployed, modulesEnabled, deployedChainIds, perChainState }
  }, [safeState])

  // Primary Safe address for display: use the first stored address
  const safeAddress = useMemo(() => {
    const storedEntry = Object.values(safeState).find(s => s.safeAddress)
    return storedEntry?.safeAddress
  }, [safeState])

  const handleDeploySafe = useCallback(
    async (chainId: number): Promise<SafeDeploymentResult> => {
      if (!evmAddress) throw new Error('No EVM wallet connected')

      setIsDeploying(true)
      try {
        const result = await deploySafe(evmAddress, chainId, evmAddress)
        setSafeStateLocal(getSafeState(evmAddress))
        return result
      } finally {
        setIsDeploying(false)
      }
    },
    [evmAddress]
  )

  const handleEnableModules = useCallback(
    async (chainId: number): Promise<string> => {
      if (!evmAddress) throw new Error('No EVM wallet connected')

      const chainState = safeState[chainId]
      if (!chainState?.safeAddress) throw new Error(`Safe not deployed on chain ${chainId}`)

      const txHash = await enableComposableCowModules(chainState.safeAddress, chainId, evmAddress)
      setSafeStateLocal(getSafeState(evmAddress))
      return txHash
    },
    [evmAddress, safeState]
  )

  return {
    safeAddress,
    isDeployed: deploymentInfo.deployed,
    isModulesEnabled: deploymentInfo.modulesEnabled,
    isSafeReady: deploymentInfo.deployed && deploymentInfo.modulesEnabled,
    isDeploying,
    deployedChainIds: deploymentInfo.deployedChainIds,
    safeDeploymentState: deploymentInfo.perChainState,
    deploySafe: handleDeploySafe,
    enableModules: handleEnableModules,
  }
}
