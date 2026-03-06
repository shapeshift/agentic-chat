import { useState } from 'react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'

import { ActivityList } from './ActivityList'
import { PortfolioAssetList } from './PortfolioAssetList'
import { PortfolioHeader } from './PortfolioHeader'
import { VaultAssetList } from './VaultPanel'

export function PortfolioPanel() {
  const [activeTab, setActiveTab] = useState('balances')
  const isVaultMode = activeTab === 'vault'

  return (
    <div className="flex flex-col h-full">
      <PortfolioHeader isVaultMode={isVaultMode} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="px-4 pb-4">
          <TabsList className="justify-start">
            <TabsTrigger value="balances" className="px-4 py-2">
              Balances
            </TabsTrigger>
            <TabsTrigger value="vault" className="px-4 py-2">
              Vault
            </TabsTrigger>
            <TabsTrigger value="activity" className="px-4 py-2">
              Activity
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="balances" className="flex-1 mt-0 min-h-0 overflow-y-auto">
          <PortfolioAssetList />
        </TabsContent>

        <TabsContent value="vault" className="flex-1 mt-0 min-h-0 overflow-y-auto">
          <VaultAssetList />
        </TabsContent>

        <TabsContent value="activity" className="flex-1 mt-0 min-h-0 overflow-y-auto">
          <ActivityList />
        </TabsContent>
      </Tabs>
    </div>
  )
}
