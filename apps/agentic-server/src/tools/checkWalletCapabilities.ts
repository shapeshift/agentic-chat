import { z } from 'zod'

import type { WalletContext } from '../utils/walletContextSimple'

export const checkWalletCapabilitiesSchema = z.object({})

export type CheckWalletCapabilitiesInput = z.infer<typeof checkWalletCapabilitiesSchema>

export type CheckWalletCapabilitiesOutput = {
  walletType: 'connected' | 'none'
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
  const isSafeReady = walletContext?.safeDeploymentState
    ? Object.values(walletContext.safeDeploymentState).some(
        s => s.isDeployed && s.modulesEnabled && s.domainVerifierSet
      )
    : false

  const baseCapabilities = ['Swap tokens', 'Send & receive', 'View portfolio', 'Limit orders']
  const automationCapabilities = ['Stop-loss orders (via Safe)', 'TWAP orders', 'DCA (dollar-cost averaging)']

  return {
    walletType: hasWallet ? 'connected' : 'none',
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
  description: `Check the connected wallet's capabilities.

Call this tool when the user asks about automated trading features (TWAP, DCA, stop-loss, scheduled trades), or asks what their wallet can do.

UI CARD DISPLAYS: wallet status, Safe smart account status, capability checklist, and setup prompts if automation features require a Safe smart account.

If the user wants automation and doesn't have a Safe yet, explain that a Safe smart account needs to be deployed first (happens automatically on first stop-loss order). Any connected wallet (MetaMask, Rabby, etc.) can own a Safe.`,
  inputSchema: checkWalletCapabilitiesSchema,
  execute: executeCheckWalletCapabilities,
}
