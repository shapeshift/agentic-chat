import Safe from '@safe-global/protocol-kit'
import { keccak256, encodePacked, createPublicClient, createWalletClient, custom } from 'viem'

import { useSafeStore } from '@/stores/safeStore'

import type { SafeProvider } from './types'

// Deterministic salt: same owner → same predicted address across all chains
function computeSafeSalt(ownerAddress: string): string {
  return keccak256(encodePacked(['address'], [ownerAddress as `0x${string}`]))
}

export interface SafeDeploymentResult {
  safeAddress: string
  isDeployed: boolean
  txHash?: string
}

// Predict the Safe address without deploying
export async function predictSafeAddress(ownerAddress: string, provider: SafeProvider): Promise<string> {
  const saltNonce = computeSafeSalt(ownerAddress)

  const protocolKit = await Safe.init({
    provider,
    predictedSafe: {
      safeAccountConfig: {
        owners: [ownerAddress],
        threshold: 1,
      },
      safeDeploymentConfig: {
        saltNonce,
      },
    },
  })

  return protocolKit.getAddress()
}

// Deploy a 1-of-1 Safe owned by the connected wallet EOA
export async function deploySafe(
  ownerAddress: string,
  chainId: number,
  signerAddress: string,
  provider: SafeProvider
): Promise<SafeDeploymentResult> {
  const saltNonce = computeSafeSalt(ownerAddress)

  // Validate provider is on the target chain before deploying
  const providerChainId = Number(await provider.request({ method: 'eth_chainId' }))
  if (providerChainId !== chainId) {
    throw new Error(
      `Provider is on chain ${providerChainId} but Safe deployment targets chain ${chainId}. Switch networks first.`
    )
  }

  const protocolKit = await Safe.init({
    provider,
    signer: signerAddress,
    predictedSafe: {
      safeAccountConfig: {
        owners: [ownerAddress],
        threshold: 1,
      },
      safeDeploymentConfig: {
        saltNonce,
      },
    },
  })

  const predictedAddress = await protocolKit.getAddress()

  // Check if already deployed
  const isAlreadyDeployed = await protocolKit.isSafeDeployed()
  if (isAlreadyDeployed) {
    const existingState = useSafeStore.getState().getChainState(ownerAddress, chainId)
    useSafeStore.getState().setChainState(ownerAddress, chainId, {
      safeAddress: predictedAddress,
      isDeployed: true,
      modulesEnabled: existingState?.modulesEnabled ?? false,
      domainVerifierSet: existingState?.domainVerifierSet ?? false,
    })
    return { safeAddress: predictedAddress, isDeployed: true }
  }

  // Deploy the Safe
  const deploymentTransaction = await protocolKit.createSafeDeploymentTransaction()

  // Send the deployment transaction via viem wallet client
  const walletClient = createWalletClient({
    transport: custom(provider),
    account: signerAddress as `0x${string}`,
    chain: undefined,
  })

  const txHash = await walletClient.sendTransaction({
    to: deploymentTransaction.to as `0x${string}`,
    data: deploymentTransaction.data as `0x${string}`,
    value: BigInt(deploymentTransaction.value),
    chain: null,
  })

  // Wait for deployment to be confirmed on-chain before marking as deployed.
  // Without this, subsequent steps (like token deposits to the Safe) would
  // prompt the wallet before the Safe contract exists, triggering warnings.
  const publicClient = createPublicClient({ transport: custom(provider) })
  const deployReceipt = await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 })
  if (deployReceipt.status === 'reverted') throw new Error(`Safe deployment transaction reverted: ${txHash}`)

  useSafeStore.getState().setChainState(ownerAddress, chainId, {
    safeAddress: predictedAddress,
    isDeployed: true,
    modulesEnabled: false,
    domainVerifierSet: false,
  })

  return {
    safeAddress: predictedAddress,
    isDeployed: true,
    txHash,
  }
}
