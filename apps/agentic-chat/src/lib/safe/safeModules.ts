import Safe from '@safe-global/protocol-kit'
import { domainSeparator, encodeFunctionData, getAddress } from 'viem'

import { getSafeState, setSafeState } from './safeStorage'

// Matches @safe-global/protocol-kit's internal Eip1193Provider (not publicly exported)
type SafeProvider = {
  request: (args: { readonly method: string; readonly params?: readonly unknown[] | object }) => Promise<unknown>
}

function getProvider(): SafeProvider {
  if (!window.ethereum) throw new Error('No ethereum provider found. Please connect your wallet.')
  return window.ethereum as SafeProvider
}

// ExtensibleFallbackHandler — required for ComposableCoW ERC-1271 verification
// Same address across Ethereum, Gnosis, Arbitrum (checksummed)
const EXTENSIBLE_FALLBACK_HANDLER = getAddress('0x2f870a80647BbC554F3a0EBD093f11B4d2a7571c')

// ComposableCoW — the contract that manages conditional orders (stop-loss, TWAP)
const COMPOSABLE_COW_ADDRESS = getAddress('0xfdaFc9d1902f4e0b84f65f49f244b32b31013b74')

// GPv2Settlement — CoW Protocol's settlement contract, used for EIP-712 domain
const GPV2_SETTLEMENT_ADDRESS = getAddress('0x9008D19f58AAbD9eD0D60971565AA8510560ab41')

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
  signerAddress: string
): Promise<string> {
  const protocolKit = await Safe.init({
    provider: getProvider(),
    signer: signerAddress,
    safeAddress,
  })

  const ownerAddress = (await protocolKit.getOwners())[0]
  const chainState = ownerAddress ? getSafeState(ownerAddress)[chainId] : undefined

  const needsFallbackHandler = !chainState?.modulesEnabled
  const needsDomainVerifier = !chainState?.domainVerifierSet

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
    throw new Error('ComposableCoW modules already fully enabled on this Safe')
  }

  // Protocol Kit auto-wraps multiple transactions in MultiSend
  const safeTx = await protocolKit.createTransaction({ transactions })
  const signedTx = await protocolKit.signTransaction(safeTx)
  const result = await protocolKit.executeTransaction(signedTx)
  const txHash = typeof result === 'string' ? result : result.hash

  if (ownerAddress) {
    const currentState = getSafeState(ownerAddress)
    const existingChainState = currentState[chainId]
    if (existingChainState) {
      setSafeState(ownerAddress, chainId, {
        ...existingChainState,
        modulesEnabled: true,
        domainVerifierSet: true,
      })
    }
  }

  return txHash
}
