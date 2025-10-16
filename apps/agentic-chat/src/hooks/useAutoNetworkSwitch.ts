import { mainnet, solana } from '@reown/appkit/networks'
import { modal } from '@reown/appkit/react'
import { useEffect, useRef } from 'react'

interface UseAutoNetworkSwitchParams {
  chainNamespace: string | undefined
  evmConnected: boolean
  solanaConnected: boolean
}

export const useAutoNetworkSwitch = ({ chainNamespace, evmConnected, solanaConnected }: UseAutoNetworkSwitchParams) => {
  const hasAttemptedSwitchRef = useRef(false)

  useEffect(() => {
    if (chainNamespace === 'solana' && !solanaConnected && evmConnected && !hasAttemptedSwitchRef.current && modal) {
      hasAttemptedSwitchRef.current = true
      modal.switchNetwork(mainnet).catch(() => {
        hasAttemptedSwitchRef.current = false
      })
      return
    }

    if (
      (chainNamespace === 'eip155' || chainNamespace === 'evm') &&
      !evmConnected &&
      solanaConnected &&
      !hasAttemptedSwitchRef.current &&
      modal
    ) {
      hasAttemptedSwitchRef.current = true
      modal.switchNetwork(solana).catch(() => {
        hasAttemptedSwitchRef.current = false
      })
      return
    }

    hasAttemptedSwitchRef.current = false
  }, [chainNamespace, evmConnected, solanaConnected])
}
