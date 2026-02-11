import { z } from 'zod'

import type { WalletContext } from '../utils/walletContextSimple'

export const checkWalletCapabilitiesSchema = z.object({})

export type CheckWalletCapabilitiesInput = z.infer<typeof checkWalletCapabilitiesSchema>

export type CheckWalletCapabilitiesOutput = {
  walletType: 'embedded' | 'external' | 'none'
  hasEmbeddedWallet: boolean
  capabilities: string[]
  automationReady: boolean
}

export function executeCheckWalletCapabilities(
  _input: CheckWalletCapabilitiesInput,
  walletContext?: WalletContext
): CheckWalletCapabilitiesOutput {
  const hasWallet = !!walletContext?.connectedWallets && Object.keys(walletContext.connectedWallets).length > 0
  const hasEmbeddedWallet = walletContext?.hasEmbeddedWallet ?? false

  const walletType: CheckWalletCapabilitiesOutput['walletType'] = !hasWallet
    ? 'none'
    : hasEmbeddedWallet
      ? 'embedded'
      : 'external'

  const baseCapabilities = ['Swap tokens', 'Send & receive', 'View portfolio', 'Limit orders']
  const automationCapabilities = ['TWAP orders', 'DCA (dollar-cost averaging)', 'Stop-loss orders']

  return {
    walletType,
    hasEmbeddedWallet,
    capabilities: hasEmbeddedWallet ? [...baseCapabilities, ...automationCapabilities] : baseCapabilities,
    automationReady: hasEmbeddedWallet,
  }
}

export const checkWalletCapabilitiesTool = {
  description: `Check the connected wallet's type and capabilities.

Call this tool when the user asks about automated trading features (TWAP, DCA, stop-loss, scheduled trades), or asks what their wallet can do, or asks about embedded vs external wallets.

UI CARD DISPLAYS: wallet type, capability checklist, and an upgrade prompt if automation features require an embedded wallet.

Your role is to supplement the card, not duplicate it. Do not list or repeat any data shown in the card.

Default: Respond with one brief, natural sentence like:
- "Here's what your wallet supports"
- "Let me check your wallet's capabilities"

If the user has an external wallet and wants automation, explain that embedded wallets enable these features - they're self-custodial MPC wallets with no seed phrase and social recovery.`,
  inputSchema: checkWalletCapabilitiesSchema,
  execute: executeCheckWalletCapabilities,
}
