import { mainnet, solana } from '@reown/appkit/networks'
import type { AppKitNetwork } from '@reown/appkit/networks'
import { modal, useAppKitAccount, useAppKitNetwork, useAppKitState } from '@reown/appkit/react'
import { useEffect, useRef } from 'react'

export function useAutoNetworkSwitch() {
  const { caipNetwork } = useAppKitNetwork()
  const evmAccount = useAppKitAccount({ namespace: 'eip155' })
  const solanaAccount = useAppKitAccount({ namespace: 'solana' })
  const { open: isModalOpen } = useAppKitState()
  const switchInProgressRef = useRef(false)

  const currentNamespace = caipNetwork?.caipNetworkId?.split(':')[0]
  const evmConnected = evmAccount.isConnected
  const solanaConnected = solanaAccount.isConnected
  const isEvmNamespace = currentNamespace === 'eip155' || currentNamespace === 'evm'

  useEffect(() => {
    if (isModalOpen) return
    if (switchInProgressRef.current) return

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
    if (!targetNetwork) return

    switchInProgressRef.current = true
    modal
      ?.switchNetwork(targetNetwork)
      .catch(err => console.warn('[useAutoNetworkSwitch] Switch failed:', err))
      .finally(() => {
        setTimeout(() => {
          switchInProgressRef.current = false
        }, 500)
      })
  }, [currentNamespace, evmConnected, solanaConnected, isEvmNamespace, isModalOpen])
}
