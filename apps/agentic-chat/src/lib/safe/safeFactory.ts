import Safe from '@safe-global/protocol-kit'
import { getPublicClient } from '@wagmi/core'
import { keccak256, encodePacked, createPublicClient, createWalletClient, custom } from 'viem'

import { SUPPORTED_EVM_CHAINS } from '@/lib/chains'
import { wagmiConfig } from '@/lib/wagmi-config'
import { useSafeStore } from '@/stores/safeStore'

import { checkDomainVerifier, checkFallbackHandler } from './safeModules'
import { createSafeProvider } from './types'
import type { SafeProvider } from './types'

// Pinned so SDK default changes can't silently break existing Safe addresses
const SAFE_VERSION = '1.3.0'

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
        safeVersion: SAFE_VERSION,
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

  // Use composite provider: reads via public RPC, writes via wallet (WalletConnect)
  const compositeProvider = createSafeProvider(chainId, provider)

  const protocolKit = await Safe.init({
    provider: compositeProvider,
    signer: signerAddress,
    predictedSafe: {
      safeAccountConfig: {
        owners: [ownerAddress],
        threshold: 1,
      },
      safeDeploymentConfig: {
        saltNonce,
        safeVersion: SAFE_VERSION,
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

  const publicClient = createPublicClient({ transport: custom(compositeProvider) })

  // Estimate gas with 20% buffer — Safe deployments on L2s like Arbitrum need
  // more gas than wallets typically estimate from the deployment calldata alone
  const estimatedGas = await publicClient.estimateGas({
    account: signerAddress as `0x${string}`,
    to: deploymentTransaction.to as `0x${string}`,
    data: deploymentTransaction.data as `0x${string}`,
    value: BigInt(deploymentTransaction.value),
  })
  const gas = estimatedGas + (estimatedGas * 20n) / 100n

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
    gas,
    chain: null,
  })
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

// Discover existing Safe deployments on-chain across all supported chains.
// Writes results directly to the Zustand store so downstream hooks re-render.
export async function discoverSafeOnChain(ownerAddress: string): Promise<void> {
  const saltNonce = computeSafeSalt(ownerAddress)

  console.log('[Safe discover] ownerAddress:', ownerAddress, '→ saltNonce:', saltNonce)

  const results = await Promise.allSettled(
    SUPPORTED_EVM_CHAINS.map(async ({ chain }) => {
      const publicClient = getPublicClient(wagmiConfig, { chainId: chain.id })
      if (!publicClient) return

      const provider: SafeProvider = { request: publicClient.request }

      const protocolKit = await Safe.init({
        provider,
        predictedSafe: {
          safeAccountConfig: {
            owners: [ownerAddress],
            threshold: 1,
          },
          safeDeploymentConfig: {
            saltNonce,
            safeVersion: SAFE_VERSION,
          },
        },
      })

      const safeAddress = await protocolKit.getAddress()
      const isDeployed = await protocolKit.isSafeDeployed()
      console.log(`[Safe discover] chain ${chain.id}: predicted=${safeAddress}, deployed=${isDeployed}`)
      if (!isDeployed) return

      const hasFallbackHandler = await checkFallbackHandler(publicClient, safeAddress)
      const hasDomainVerifier = hasFallbackHandler
        ? await checkDomainVerifier(publicClient, safeAddress, chain.id)
        : false

      useSafeStore.getState().setChainState(ownerAddress, chain.id, {
        safeAddress,
        isDeployed: true,
        modulesEnabled: hasFallbackHandler,
        domainVerifierSet: hasDomainVerifier,
      })
    })
  )

  // Log any failures for debugging but don't throw — partial discovery is fine
  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn('[Safe discovery] chain check failed:', result.reason)
    }
  }
}
