import Safe from '@safe-global/protocol-kit'
import { createPublicClient, custom, domainSeparator, encodeFunctionData, getAddress } from 'viem'

import { useSafeStore } from '@/stores/safeStore'

import type { SafeProvider } from './types'

// ExtensibleFallbackHandler — required for ComposableCoW ERC-1271 verification
// Same address across Ethereum, Gnosis, Arbitrum (checksummed)
const EXTENSIBLE_FALLBACK_HANDLER = getAddress('0x2f55e8b20D0B9FEFA187AA7d00B6Cbe563605bF5')

// ComposableCoW — the contract that manages conditional orders (stop-loss, TWAP)
const COMPOSABLE_COW_ADDRESS = getAddress('0xfdaFc9d1902f4e0b84f65f49f244b32b31013b74')

// GPv2Settlement — CoW Protocol's settlement contract, used for EIP-712 domain
const GPV2_SETTLEMENT_ADDRESS = getAddress('0x9008D19f58AAbD9eD0D60971565AA8510560ab41')

// Safe's fallback handler is stored at a well-known storage slot (EIP-1967 style)
const FALLBACK_HANDLER_SLOT = '0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5' as const

const SET_FALLBACK_HANDLER_ABI = [
  {
    name: 'setFallbackHandler',
    type: 'function',
    inputs: [{ name: 'handler', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

const SET_DOMAIN_VERIFIER_ABI = [
  {
    name: 'setDomainVerifier',
    type: 'function',
    inputs: [
      { name: 'domainSeparator', type: 'bytes32' },
      { name: 'newVerifier', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

const GET_DOMAIN_VERIFIER_ABI = [
  {
    name: 'domainVerifiers',
    type: 'function',
    inputs: [
      { name: 'safe', type: 'address' },
      { name: 'domainSeparator', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
] as const

function computeGpv2DomainSeparator(chainId: number): `0x${string}` {
  return domainSeparator({
    domain: {
      name: 'Gnosis Protocol',
      version: 'v2',
      chainId,
      verifyingContract: GPV2_SETTLEMENT_ADDRESS,
    },
  })
}

export async function enableComposableCowModules(
  safeAddress: string,
  chainId: number,
  signerAddress: string,
  provider: SafeProvider
): Promise<string> {
  const protocolKit = await Safe.init({
    provider,
    signer: signerAddress,
    safeAddress,
  })

  const publicClient = createPublicClient({ transport: custom(provider) })
  const connectedChainId = await publicClient.getChainId()
  if (connectedChainId !== chainId) {
    throw new Error(
      `Chain mismatch: wallet is on chain ${connectedChainId} but expected ${chainId}. Switch networks first.`
    )
  }

  // On-chain verification: read fallback handler from Safe's storage slot
  const currentFallbackHandler = await publicClient.getStorageAt({
    address: safeAddress as `0x${string}`,
    slot: FALLBACK_HANDLER_SLOT,
  })
  const fallbackHandlerAddress = currentFallbackHandler
    ? getAddress(`0x${currentFallbackHandler.slice(26)}`)
    : getAddress('0x0000000000000000000000000000000000000000')
  const needsFallbackHandler = fallbackHandlerAddress !== EXTENSIBLE_FALLBACK_HANDLER

  // On-chain verification: read domain verifier from ExtensibleFallbackHandler
  let needsDomainVerifier = true
  if (!needsFallbackHandler) {
    const gpv2DomainSep = computeGpv2DomainSeparator(chainId)
    const currentVerifier = await publicClient.readContract({
      address: EXTENSIBLE_FALLBACK_HANDLER,
      abi: GET_DOMAIN_VERIFIER_ABI,
      functionName: 'domainVerifiers',
      args: [safeAddress as `0x${string}`, gpv2DomainSep],
    })
    needsDomainVerifier = getAddress(currentVerifier) !== COMPOSABLE_COW_ADDRESS
  }

  const transactions: Array<{ to: string; value: string; data: string }> = []

  // setFallbackHandler must come before setDomainVerifier in the batch,
  // because the fallback handler dispatches the setDomainVerifier call
  if (needsFallbackHandler) {
    transactions.push({
      to: safeAddress,
      value: '0',
      data: encodeFunctionData({
        abi: SET_FALLBACK_HANDLER_ABI,
        functionName: 'setFallbackHandler',
        args: [EXTENSIBLE_FALLBACK_HANDLER],
      }),
    })
  }

  if (needsDomainVerifier) {
    const gpv2DomainSep = computeGpv2DomainSeparator(chainId)
    transactions.push({
      to: safeAddress,
      value: '0',
      data: encodeFunctionData({
        abi: SET_DOMAIN_VERIFIER_ABI,
        functionName: 'setDomainVerifier',
        args: [gpv2DomainSep, COMPOSABLE_COW_ADDRESS],
      }),
    })
  }

  if (transactions.length === 0) {
    // Modules already fully configured on-chain — update store to match
    const ownerAddress = (await protocolKit.getOwners())[0]
    if (ownerAddress) {
      const existingChainState = useSafeStore.getState().getChainState(ownerAddress, chainId)
      useSafeStore.getState().setChainState(ownerAddress, chainId, {
        safeAddress: existingChainState?.safeAddress ?? safeAddress,
        isDeployed: existingChainState?.isDeployed ?? true,
        modulesEnabled: true,
        domainVerifierSet: true,
      })
    }
    throw new Error('ComposableCoW modules already fully enabled on this Safe')
  }

  // Protocol Kit auto-wraps multiple transactions in MultiSend
  const safeTx = await protocolKit.createTransaction({ transactions })
  const signedTx = await protocolKit.signTransaction(safeTx)
  const result = await protocolKit.executeTransaction(signedTx)
  const txHash = typeof result === 'string' ? result : result.hash

  // Wait for module enable tx to be confirmed before updating state
  const moduleReceipt = await publicClient.waitForTransactionReceipt({
    hash: txHash as `0x${string}`,
    confirmations: 1,
  })
  if (moduleReceipt.status === 'reverted') throw new Error(`Module enable transaction reverted: ${txHash}`)

  const ownerAddress = (await protocolKit.getOwners())[0]
  if (ownerAddress) {
    const existingChainState = useSafeStore.getState().getChainState(ownerAddress, chainId)
    useSafeStore.getState().setChainState(ownerAddress, chainId, {
      safeAddress: existingChainState?.safeAddress ?? safeAddress,
      isDeployed: existingChainState?.isDeployed ?? true,
      modulesEnabled: true,
      domainVerifierSet: true,
    })
  }

  return txHash
}
