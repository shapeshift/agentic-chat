import { isEthereumWallet } from '@dynamic-labs/ethereum'
import { useDynamicContext, useUserWallets } from '@dynamic-labs/sdk-react-core'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

import { deploySafe, discoverSafeOnChain, enableComposableCowModules, predictSafeAddress } from '@/lib/safe'
import type { SafeDeploymentResult } from '@/lib/safe'
import { findEvmWallet } from '@/lib/walletUtils'
import { useSafeStore } from '@/stores/safeStore'

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
  deployedChainIds: number[]
  safeDeploymentState: Record<number, SafeChainDeployment>
  deploySafe: (chainId: number) => Promise<SafeDeploymentResult>
  enableModules: (chainId: number) => Promise<string>
}

export function useSafeAccount(): UseSafeAccountResult {
  // Use same EVM wallet selection as useWalletConnection: prefer primaryWallet if EVM, else first EVM
  const { primaryWallet } = useDynamicContext()
  const userWallets = useUserWallets()
  const evmWallet = useMemo(() => {
    const primaryEvm = primaryWallet && isEthereumWallet(primaryWallet) ? primaryWallet : undefined
    return primaryEvm ?? findEvmWallet(userWallets)
  }, [primaryWallet, userWallets])
  const evmAddress = evmWallet?.address

  const deployments = useSafeStore(state => state.deployments)

  const safeState = useMemo(() => {
    return evmAddress ? (deployments[evmAddress.toLowerCase()] ?? {}) : {}
  }, [evmAddress, deployments])

  // Predict Safe address via CREATE2 — deterministic, never changes for a given owner
  const predictedAddressQuery = useQuery({
    queryKey: ['safe-predicted-address', evmAddress],
    queryFn: async () => {
      const walletClient = await evmWallet!.getWalletClient()
      const result = await predictSafeAddress(evmAddress!, walletClient)
      return result
    },
    enabled: !!evmAddress && !!evmWallet,
    staleTime: Infinity,
  })

  // Discover deployed Safes on-chain when the store is empty for this owner
  useQuery({
    queryKey: ['safe-discovery', evmAddress],
    queryFn: () => discoverSafeOnChain(evmAddress!),
    enabled: !!evmAddress && Object.keys(safeState).length === 0,
    staleTime: Infinity,
    retry: 1,
  })

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

  // Primary Safe address: first deployed address, or predicted address for new users
  const safeAddress = useMemo(() => {
    const storedEntry = Object.values(safeState).find(s => s.safeAddress)
    return storedEntry?.safeAddress ?? predictedAddressQuery.data
  }, [safeState, predictedAddressQuery.data])

  const handleDeploySafe = useCallback(
    async (chainId: number): Promise<SafeDeploymentResult> => {
      if (!evmAddress || !evmWallet) throw new Error('No EVM wallet connected')

      const walletClient = await evmWallet.getWalletClient()
      return await deploySafe(evmAddress, chainId, evmAddress, walletClient)
    },
    [evmAddress, evmWallet]
  )

  const handleEnableModules = useCallback(
    async (chainId: number): Promise<string> => {
      if (!evmAddress || !evmWallet) throw new Error('No EVM wallet connected')

      const chainState = safeState[chainId]
      if (!chainState?.safeAddress) throw new Error(`Safe not deployed on chain ${chainId}`)

      const walletClient = await evmWallet.getWalletClient()
      return await enableComposableCowModules(chainState.safeAddress, chainId, evmAddress, walletClient)
    },
    [evmAddress, evmWallet, safeState]
  )

  return {
    safeAddress,
    isDeployed: deploymentInfo.deployed,
    isModulesEnabled: deploymentInfo.modulesEnabled,
    isSafeReady: deploymentInfo.deployed && deploymentInfo.modulesEnabled,
    deployedChainIds: deploymentInfo.deployedChainIds,
    safeDeploymentState: deploymentInfo.perChainState,
    deploySafe: handleDeploySafe,
    enableModules: handleEnableModules,
  }
}
