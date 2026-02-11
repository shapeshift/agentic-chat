import { useDynamicContext } from '@dynamic-labs/sdk-react-core'
import type { CheckWalletCapabilitiesOutput } from '@shapeshiftoss/agentic-server'
import { Check, Lock, Shield } from 'lucide-react'
import { useCallback } from 'react'

import { Button } from '../ui/Button'
import { StatusText } from '../ui/StatusText'
import { ToolCard } from '../ui/ToolCard'

import { useToolStateRender } from './toolUIHelpers'
import type { ToolUIComponentProps } from './toolUIHelpers'

const WALLET_TYPE_LABELS: Record<string, string> = {
  embedded: 'Embedded (MPC)',
  external: 'External (BYO)',
  none: 'No Wallet Connected',
}

export function CheckWalletCapabilitiesUI({ toolPart }: ToolUIComponentProps) {
  const { state, output, errorText } = toolPart
  const capabilitiesOutput = output as CheckWalletCapabilitiesOutput | undefined
  const { setShowAuthFlow } = useDynamicContext()

  const handleCreateEmbeddedWallet = useCallback(() => {
    setShowAuthFlow(true)
  }, [setShowAuthFlow])

  const stateRender = useToolStateRender(state, {
    loading: 'Checking wallet capabilities...',
    error: null,
  })

  if (stateRender) return stateRender

  if (state === 'output-error') {
    const message = typeof errorText === 'string' ? errorText : 'Failed to check wallet capabilities'
    return <StatusText.Error>{message}</StatusText.Error>
  }

  if (!capabilitiesOutput) return null

  const { walletType, capabilities, automationReady } = capabilitiesOutput
  const walletTypeLabel = WALLET_TYPE_LABELS[walletType] ?? walletType

  return (
    <ToolCard.Root>
      <ToolCard.Header>
        <ToolCard.HeaderRow>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium">Wallet Capabilities</span>
          </div>
          <span className="text-xs text-muted-foreground">{walletTypeLabel}</span>
        </ToolCard.HeaderRow>
      </ToolCard.Header>
      <ToolCard.Content>
        <ToolCard.Details>
          <div className="space-y-1.5">
            {capabilities.map(capability => (
              <div key={capability} className="flex items-center gap-2 text-sm">
                <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                <span className="text-muted-foreground">{capability}</span>
              </div>
            ))}
          </div>

          {!automationReady && walletType !== 'none' && (
            <div className="mt-3 rounded-md border border-blue-500/30 bg-blue-500/10 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-200">
                  Automated trading features (TWAP, DCA, stop-loss) require an embedded wallet. Create one with email or
                  social login — it's self-custodial with no seed phrase.
                </div>
              </div>
              <Button variant="default" size="sm" onClick={handleCreateEmbeddedWallet} className="w-full">
                Create Embedded Wallet
              </Button>
            </div>
          )}

          {walletType === 'none' && (
            <div className="mt-3 rounded-md border border-blue-500/30 bg-blue-500/10 p-3 space-y-2">
              <div className="text-xs text-blue-200">
                Connect a wallet to get started with trading and portfolio management.
              </div>
              <Button variant="default" size="sm" onClick={handleCreateEmbeddedWallet} className="w-full">
                Connect Wallet
              </Button>
            </div>
          )}
        </ToolCard.Details>
      </ToolCard.Content>
    </ToolCard.Root>
  )
}
