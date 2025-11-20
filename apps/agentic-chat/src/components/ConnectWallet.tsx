import React, { useState } from 'react'

import { CustomConnectButton } from './CustomConnectButton'
import { PortfolioDrawer } from './Portfolio/PortfolioDrawer'

export const ConnectWallet: React.FC = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const handleWalletClick = () => {
    setIsDrawerOpen(true)
  }

  return (
    <>
      <div className="flex gap-2">
        <CustomConnectButton onConnectedClick={handleWalletClick} />
      </div>
      <PortfolioDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </>
  )
}
