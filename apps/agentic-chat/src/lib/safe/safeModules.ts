import Safe from '@safe-global/protocol-kit'
import { encodeFunctionData, getAddress } from 'viem'

import { setSafeState, getSafeState } from './safeStorage'

// Matches @safe-global/protocol-kit's internal Eip1193Provider (not publicly exported)
type SafeProvider = {
  request: (args: { readonly method: string; readonly params?: readonly unknown[] | object }) => Promise<unknown>
}

function getProvider(): SafeProvider {
  if (!window.ethereum) throw new Error('No ethereum provider found. Please connect your wallet.')
  return window.ethereum as SafeProvider
}

// ExtensibleFallbackHandler — required for ComposableCoW ERC-1271 verification
// This is the handler that allows ComposableCoW to verify signatures via the Safe
// Same address across Ethereum, Gnosis, Arbitrum (checksummed)
const EXTENSIBLE_FALLBACK_HANDLER = getAddress('0x2f870a80647BbC554F3a0EBD093f11B4d2a7571c')

const SET_FALLBACK_HANDLER_ABI = [
  {
    name: 'setFallbackHandler',
    type: 'function',
    inputs: [{ name: 'handler', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

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

  // Encode setFallbackHandler(address) calldata manually to bypass SDK validation
  // The Safe SDK's createEnableFallbackHandlerTx rejects non-whitelisted handler addresses
  const calldata = encodeFunctionData({
    abi: SET_FALLBACK_HANDLER_ABI,
    functionName: 'setFallbackHandler',
    args: [EXTENSIBLE_FALLBACK_HANDLER],
  })

  const setFallbackHandlerTx = await protocolKit.createTransaction({
    transactions: [
      {
        to: safeAddress,
        value: '0',
        data: calldata,
      },
    ],
  })

  const result = await protocolKit.executeTransaction(setFallbackHandlerTx)
  const txHash = typeof result === 'string' ? result : result.hash

  // Update storage to reflect modules are enabled
  const ownerAddress = (await protocolKit.getOwners())[0]
  if (ownerAddress) {
    const currentState = getSafeState(ownerAddress)
    const chainState = currentState[chainId]
    if (chainState) {
      setSafeState(ownerAddress, chainId, {
        ...chainState,
        modulesEnabled: true,
      })
    }
  }

  return txHash
}
