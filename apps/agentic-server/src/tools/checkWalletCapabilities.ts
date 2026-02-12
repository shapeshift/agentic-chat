import { z } from 'zod'

import type { WalletContext } from '../utils/walletContextSimple'

export const checkWalletCapabilitiesSchema = z.object({})

export type CheckWalletCapabilitiesInput = z.infer<typeof checkWalletCapabilitiesSchema>

export type CheckWalletCapabilitiesOutput = {
  walletType: 'embedded' | 'external' | 'both' | 'none'
  hasEmbeddedWallet: boolean
  hasExternalWallet: boolean
  safeAddress?: string
  isSafeReady: boolean
  capabilities: string[]
  automationReady: boolean
}

export function executeCheckWalletCapabilities(
  _input: CheckWalletCapabilitiesInput,
  walletContext?: WalletContext
): CheckWalletCapabilitiesOutput {
  const hasWallet = !!walletContext?.connectedWallets && Object.keys(walletContext.connectedWallets).length > 0
  const hasEmbeddedWallet = walletContext?.hasEmbeddedWallet ?? false
  const hasExternalWallet = walletContext?.hasExternalWallet ?? false
  const isSafeReady = walletContext?.isSafeReady ?? false

  const walletType: CheckWalletCapabilitiesOutput['walletType'] = !hasWallet
    ? 'none'
    : hasEmbeddedWallet && hasExternalWallet
      ? 'both'
      : hasEmbeddedWallet
        ? 'embedded'
        : 'external'

  const baseCapabilities = ['Swap tokens', 'Send & receive', 'View portfolio', 'Limit orders']
  const automationCapabilities = ['Stop-loss orders (via Safe)', 'TWAP orders', 'DCA (dollar-cost averaging)']

  return {
    walletType,
    hasEmbeddedWallet,
    hasExternalWallet,
    safeAddress: walletContext?.safeAddress,
    isSafeReady,
    capabilities: isSafeReady
      ? [...baseCapabilities, ...automationCapabilities]
      : hasWallet
        ? [...baseCapabilities, 'Safe smart account setup needed for automation']
        : baseCapabilities,
    automationReady: isSafeReady,
  }
}

export const checkWalletCapabilitiesTool = {
  description: `Check the connected wallet's type and capabilities.

Call this tool when the user asks about automated trading features (TWAP, DCA, stop-loss, scheduled trades), or asks what their wallet can do, or asks about embedded vs external wallets.

UI CARD DISPLAYS: wallet type, Safe smart account status, capability checklist, and setup prompts if automation features require a Safe smart account.

Your role is to supplement the card, not duplicate it. Do not list or repeat any data shown in the card.

Default: Respond with one brief, natural sentence like:
- "Here's what your wallet supports"
- "Let me check your wallet's capabilities"

If the user wants automation and doesn't have a Safe yet, explain that a Safe smart account needs to be deployed first (happens automatically on first stop-loss order). Any connected wallet (MetaMask, Rabby, embedded, etc.) can own a Safe.`,
  inputSchema: checkWalletCapabilitiesSchema,
  execute: executeCheckWalletCapabilities,
}
