import Safe from '@safe-global/protocol-kit'
import { keccak256, encodePacked, createWalletClient, custom } from 'viem'

import { setSafeState } from './safeStorage'

// Matches @safe-global/protocol-kit's internal Eip1193Provider (not publicly exported)
type SafeProvider = {
  request: (args: { readonly method: string; readonly params?: readonly unknown[] | object }) => Promise<unknown>
}

function getProvider(): SafeProvider {
  if (!window.ethereum) throw new Error('No ethereum provider found. Please connect your wallet.')
  return window.ethereum as SafeProvider
}

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
export async function predictSafeAddress(ownerAddress: string): Promise<string> {
  const saltNonce = computeSafeSalt(ownerAddress)

  const protocolKit = await Safe.init({
    provider: getProvider(),
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
  signerAddress: string
): Promise<SafeDeploymentResult> {
  const saltNonce = computeSafeSalt(ownerAddress)

  const protocolKit = await Safe.init({
    provider: getProvider(),
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
    setSafeState(ownerAddress, chainId, {
      safeAddress: predictedAddress,
      isDeployed: true,
      modulesEnabled: false,
    })
    return { safeAddress: predictedAddress, isDeployed: true }
  }

  // Deploy the Safe
  const deploymentTransaction = await protocolKit.createSafeDeploymentTransaction()

  // Send the deployment transaction via viem wallet client
  const walletClient = createWalletClient({
    transport: custom(getProvider()),
    account: signerAddress as `0x${string}`,
    chain: undefined,
  })

  const txHash = await walletClient.sendTransaction({
    to: deploymentTransaction.to as `0x${string}`,
    data: deploymentTransaction.data as `0x${string}`,
    value: BigInt(deploymentTransaction.value),
    chain: null,
  })

  setSafeState(ownerAddress, chainId, {
    safeAddress: predictedAddress,
    isDeployed: true,
    modulesEnabled: false,
  })

  return {
    safeAddress: predictedAddress,
    isDeployed: true,
    txHash,
  }
}
