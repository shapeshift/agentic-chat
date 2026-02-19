import type { Asset } from '@shapeshiftoss/types'

import type { SendInput, SendOutput, SendSummary } from '../lib/schemas/sendSchemas'
import { sendSchema } from '../lib/schemas/sendSchemas'
import type { TransactionData } from '../lib/schemas/swapSchemas'
import { validateAddress } from '../utils/addressValidation'
import { isNativeToken, resolveAsset } from '../utils/assetHelpers'
import { getBalance, validateSufficientBalance } from '../utils/balanceHelpers'
import { isEvmChain, isSolanaChain } from '../utils/chains/helpers'
import { calculateMaxSendAmount, formatEstimatedFee } from '../utils/feeEstimation'
import { networkToFeeSymbol } from '../utils/networkHelpers'
import { buildEvmNativeTransfer, buildEvmTokenTransfer, buildSolanaTransfer } from '../utils/transactionHelpers'
import { getAddressForChain } from '../utils/walletContextSimple'
import type { WalletContext } from '../utils/walletContextSimple'

const SOLANA_RPC_URL = (() => {
  const url = process.env.VITE_SOLANA_RPC_URL
  if (!url) {
    throw new Error('VITE_SOLANA_RPC_URL environment variable is required')
  }
  return url
})()

export async function executeSend(input: SendInput, walletContext?: WalletContext): Promise<SendOutput> {
  console.log('[send]:', input)

  // 1. Resolve asset (prioritize tokens user owns)
  const asset = await resolveAsset(input.asset, walletContext)

  // 2. Get sender address
  const from = getAddressForChain(walletContext, asset.chainId)

  // 3. Validate recipient address
  validateAddress(input.recipient, asset.chainId)

  // 4. Get balance and calculate send amount (handle "max")
  const balance = await getBalance(from, asset)

  let sendAmount: string
  if (input.amount.toLowerCase() === 'max') {
    sendAmount = await calculateMaxSendAmount(asset, balance, from, input.recipient)
  } else {
    // Validate amount
    if (!Number.isFinite(parseFloat(input.amount)) || parseFloat(input.amount) <= 0) {
      throw new Error('Amount must be a positive number')
    }
    sendAmount = input.amount

    // Check balance
    await validateSufficientBalance(from, asset, sendAmount)
  }

  // 5. Build transaction
  const txResult = await buildSendTransaction(asset, from, input.recipient, sendAmount)

  // 6. Create summary
  const summary = createSendSummary(asset, from, input.recipient, sendAmount, txResult)

  return {
    summary,
    tx: txResult.tx,
    sendData: {
      assetId: asset.assetId,
      from,
      to: input.recipient,
      amount: sendAmount,
      chainId: asset.chainId,
      asset,
    },
  }
}

async function buildSendTransaction(
  asset: Asset,
  from: string,
  to: string,
  amount: string
): Promise<{ tx: TransactionData; needsAtaCreation?: boolean }> {
  if (isEvmChain(asset.chainId)) {
    const tx = isNativeToken(asset)
      ? buildEvmNativeTransfer(asset, from, to, amount)
      : buildEvmTokenTransfer(asset, from, to, amount)
    return { tx }
  } else if (isSolanaChain(asset.chainId)) {
    const result = await buildSolanaTransfer(asset, from, to, amount, SOLANA_RPC_URL)
    return { tx: result, needsAtaCreation: result.needsAtaCreation }
  }

  throw new Error(`Unsupported chain: ${asset.chainId}`)
}

function createSendSummary(
  asset: Asset,
  from: string,
  to: string,
  amount: string,
  txResult: { tx: TransactionData; needsAtaCreation?: boolean }
): SendSummary {
  const assetPrice = parseFloat(asset.price || '0')
  const valueUSD = assetPrice > 0 ? (parseFloat(amount) * assetPrice).toFixed(2) : null

  const feeSymbol = networkToFeeSymbol[asset.network] || asset.symbol.toUpperCase()
  const estimatedFeeCrypto = formatEstimatedFee(asset.chainId, isNativeToken(asset), txResult.needsAtaCreation)

  return {
    asset: `${amount} ${asset.symbol.toUpperCase()}`,
    symbol: asset.symbol.toUpperCase(),
    amount,
    from: `${from.slice(0, 6)}...${from.slice(-4)}`,
    to: `${to.slice(0, 6)}...${to.slice(-4)}`,
    network: asset.network,
    chainName: asset.network,
    estimatedFeeCrypto,
    estimatedFeeSymbol: feeSymbol,
    estimatedFeeUsd: valueUSD,
    ...(txResult.needsAtaCreation && { ataCreation: true }),
  }
}

export const sendTool = {
  description: `Send crypto to an address.

UI CARD DISPLAYS: send amount, from/to addresses, network, and estimated fees.`,
  inputSchema: sendSchema,
  execute: executeSend,
}

export type { SendInput, SendOutput }
