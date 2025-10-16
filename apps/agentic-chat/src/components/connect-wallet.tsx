import React from 'react'

import { CustomConnectButton } from './custom-connect-button'

export const ConnectWallet: React.FC = () => {
  return (
    <div className="flex gap-2">
      <CustomConnectButton />
    </div>
  )
}
