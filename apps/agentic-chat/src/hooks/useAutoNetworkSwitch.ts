import { mainnet, solana } from '@reown/appkit/networks'
import type { AppKitNetwork } from '@reown/appkit/networks'
import { modal, useAppKitAccount, useAppKitNetwork, useAppKitState } from '@reown/appkit/react'
import { useEffect } from 'react'

export function useAutoNetworkSwitch() {
  const { caipNetwork } = useAppKitNetwork()
  const evmAccount = useAppKitAccount({ namespace: 'eip155' })
  const solanaAccount = useAppKitAccount({ namespace: 'solana' })
  const { open: isModalOpen } = useAppKitState()

  const currentNamespace = caipNetwork?.caipNetworkId?.split(':')[0]
  const evmConnected = evmAccount.isConnected
  const solanaConnected = solanaAccount.isConnected
  const isEvmNamespace = currentNamespace === 'eip155' || currentNamespace === 'evm'

  useEffect(() => {
    if (isModalOpen) return

    const getTargetNetwork = (): AppKitNetwork | undefined => {
      if (currentNamespace === 'solana' && !solanaConnected && evmConnected) {
        return mainnet
      }
      if (isEvmNamespace && !evmConnected && solanaConnected) {
        return solana
      }
      return undefined
    }

    const targetNetwork = getTargetNetwork()
    if (targetNetwork) {
      void modal?.switchNetwork(targetNetwork)
    }
  }, [currentNamespace, evmConnected, solanaConnected, isEvmNamespace, isModalOpen])
}
