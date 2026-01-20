import type { ReceiveInput, ReceiveOutput } from '../lib/schemas/receiveSchemas'
import { receiveSchema } from '../lib/schemas/receiveSchemas'
import { resolveAsset } from '../utils/assetHelpers'
import { supportsTxOperations } from '../utils/chains/helpers'
import { getAddressForChain } from '../utils/walletContextSimple'
import type { WalletContext } from '../utils/walletContextSimple'

export async function executeReceive(input: ReceiveInput, walletContext?: WalletContext): Promise<ReceiveOutput> {
  console.log('[receive]:', input)

  const asset = await resolveAsset(input.asset, walletContext)

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
  description: `Get receive address for an asset or network.

UI CARD DISPLAYS: wallet address and QR code for receiving funds.

Your role is to supplement the card, not duplicate it. Do not repeat the address.

Default: Respond with one brief, natural sentence like:
- "Here's your receive address"
- "You can receive funds at this address"
- "Here's where to send your funds"

Only elaborate if the user asks about something not shown in the card.`,
  inputSchema: receiveSchema,
  execute: executeReceive,
}

export type { ReceiveInput, ReceiveOutput }
