import { isEthereumWallet } from '@dynamic-labs/ethereum'
import { useUserWallets } from '@dynamic-labs/sdk-react-core'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { deploySafe, enableComposableCowModules, getSafeState, predictSafeAddress } from '@/lib/safe'
import type { SafeDeploymentResult } from '@/lib/safe'

export interface UseSafeAccountResult {
  safeAddress: string | undefined
  isDeployed: boolean
  isModulesEnabled: boolean
  isSafeReady: boolean // deployed + modules enabled on any chain
  isDeploying: boolean
  deploySafe: (chainId: number) => Promise<SafeDeploymentResult>
  enableModules: (chainId: number) => Promise<string>
}

export function useSafeAccount(): UseSafeAccountResult {
  // Get wallet info directly from Dynamic SDK to avoid circular dependency with useWalletConnection
  const userWallets = useUserWallets()
  const hasEmbeddedWallet = userWallets.some(w => w.connector?.isEmbeddedWallet === true)
  const evmAddress = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- SDK type variance
    const evmWallet = userWallets.find(w => isEthereumWallet(w))
    return evmWallet?.address
  }, [userWallets])

  const [predictedAddress, setPredictedAddress] = useState<string | undefined>()
  const [safeState, setSafeStateLocal] = useState<ReturnType<typeof getSafeState>>({})
  const [isDeploying, setIsDeploying] = useState(false)

  // Load Safe state from localStorage when address changes
  useEffect(() => {
    if (evmAddress && hasEmbeddedWallet) {
      setSafeStateLocal(getSafeState(evmAddress))
    } else {
      setSafeStateLocal({})
    }
  }, [evmAddress, hasEmbeddedWallet])

  // Predict Safe address on load (same address across all chains)
  useEffect(() => {
    if (!evmAddress || !hasEmbeddedWallet) return

    void predictSafeAddress(evmAddress)
      .then(predicted => {
        setPredictedAddress(predicted)
      })
      .catch(() => {
        // Prediction may fail if no provider available
      })
  }, [evmAddress, hasEmbeddedWallet])

  // Check if Safe is deployed + modules enabled on any chain
  const deploymentInfo = useMemo(() => {
    const entries = Object.values(safeState)
    const deployed = entries.some(s => s.isDeployed)
    const modulesEnabled = entries.some(s => s.modulesEnabled)
    return { deployed, modulesEnabled }
  }, [safeState])

  // Safe address: prefer stored address from deployment, fall back to predicted
  const safeAddress = useMemo(() => {
    const storedEntry = Object.values(safeState).find(s => s.safeAddress)
    return storedEntry?.safeAddress ?? predictedAddress
  }, [safeState, predictedAddress])

  const handleDeploySafe = useCallback(
    async (chainId: number): Promise<SafeDeploymentResult> => {
      if (!evmAddress) throw new Error('No embedded wallet connected')

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
      if (!evmAddress) throw new Error('No embedded wallet connected')

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
    deploySafe: handleDeploySafe,
    enableModules: handleEnableModules,
  }
}
