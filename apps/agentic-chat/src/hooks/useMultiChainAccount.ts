import { useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react'
import type { ChainNamespace as CAIPChainNamespace } from '@shapeshiftoss/caip'
import { CHAIN_NAMESPACE } from '@shapeshiftoss/caip'
import { useMemo } from 'react'
import { useAccount } from 'wagmi'

type ChainNamespace = CAIPChainNamespace | string

interface MultiChainAccountState {
  address: string | undefined
  isConnected: boolean
  chainNamespace: ChainNamespace | undefined
  allConnections: {
    evm: { address: string | undefined; isConnected: boolean }
    solana: { address: string | undefined; isConnected: boolean }
  }
}

export const useMultiChainAccount = (): MultiChainAccountState => {
  const { caipNetwork } = useAppKitNetwork()
  const evmAccount = useAccount()
  const { address: solanaAddress, isConnected: isSolanaConnected } = useAppKitAccount({ namespace: 'solana' })
  const { address: evmAddress, isConnected: isEvmConnected } = useAppKitAccount({ namespace: 'eip155' })

  return useMemo(() => {
    const activeEvmAddress = evmAddress || evmAccount.address
    const chainNamespace = caipNetwork?.chainNamespace as ChainNamespace | undefined

    const evmConnected = isEvmConnected && !!activeEvmAddress
    const solanaConnected = isSolanaConnected && !!solanaAddress

    let activeAddress: string | undefined
    let isConnected = false

    if (chainNamespace === CHAIN_NAMESPACE.Solana) {
      activeAddress = solanaAddress
      isConnected = solanaConnected
    } else if (chainNamespace === CHAIN_NAMESPACE.Evm) {
      activeAddress = activeEvmAddress
      isConnected = evmConnected
    } else {
      activeAddress = activeEvmAddress || solanaAddress
      isConnected = evmConnected || solanaConnected
    }

    return {
      address: activeAddress,
      isConnected,
      chainNamespace,
      allConnections: {
        evm: { address: activeEvmAddress, isConnected: evmConnected },
        solana: { address: solanaAddress, isConnected: solanaConnected },
      },
    }
  }, [caipNetwork, evmAccount.address, evmAddress, isEvmConnected, solanaAddress, isSolanaConnected])
}
