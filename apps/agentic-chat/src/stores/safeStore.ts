import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface SafeChainState {
  safeAddress: string
  isDeployed: boolean
  modulesEnabled: boolean
  domainVerifierSet: boolean
}

interface SafeStore {
  // ownerAddress (lowercase) -> chainId -> chain state
  deployments: Record<string, Record<number, SafeChainState>>
  setChainState: (ownerAddress: string, chainId: number, state: SafeChainState) => void
  getChainState: (ownerAddress: string, chainId: number) => SafeChainState | undefined
  getOwnerState: (ownerAddress: string) => Record<number, SafeChainState>
}

export const useSafeStore = create<SafeStore>()(
  persist(
    (set, get) => ({
      deployments: {},
      setChainState: (ownerAddress, chainId, state) =>
        set(prev => ({
          deployments: {
            ...prev.deployments,
            [ownerAddress.toLowerCase()]: {
              ...(prev.deployments[ownerAddress.toLowerCase()] ?? {}),
              [chainId]: state,
            },
          },
        })),
      getChainState: (ownerAddress, chainId) => get().deployments[ownerAddress.toLowerCase()]?.[chainId],
      getOwnerState: ownerAddress => get().deployments[ownerAddress.toLowerCase()] ?? {},
    }),
    {
      name: 'safe-deployments',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      migrate: persisted => persisted as SafeStore,
    }
  )
)
