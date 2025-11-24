import type { ReceiveInput, ReceiveOutput } from '../lib/schemas/receiveSchemas'
import { receiveSchema } from '../lib/schemas/receiveSchemas'
import { resolveAsset } from '../utils/assetHelpers'
import { supportsTxOperations } from '../utils/chains/helpers'
import { getAddressForChain } from '../utils/walletContextSimple'
import type { WalletContext } from '../utils/walletContextSimple'

export async function executeReceive(input: ReceiveInput, walletContext?: WalletContext): Promise<ReceiveOutput> {
  console.log('[receive]:', input)

  const asset = await resolveAsset(input.asset)

  if (!supportsTxOperations(asset.chainId)) {
    throw new Error(
      `Receiving on ${asset.network} is not currently supported. Only EVM chains and Solana are supported.`
    )
  }

  const address = getAddressForChain(walletContext, asset.chainId)

  return {
    address,
    network: asset.network,
    chainId: asset.chainId,
    asset: {
      symbol: asset.symbol.toUpperCase(),
      name: asset.name,
      assetId: asset.assetId,
    },
  }
}

export const receiveTool = {
  description:
    'Get a wallet address for receiving cryptocurrency. Returns the address and QR code for the specified asset/network. The address is the same for all tokens on a given network (e.g., all ERC-20 tokens share the same Ethereum address).',
  inputSchema: receiveSchema,
  execute: executeReceive,
}

export type { ReceiveInput, ReceiveOutput }
