import { fromAssetId, fromChainId } from '@shapeshiftoss/caip'
import type { Asset } from '@shapeshiftoss/types'
import { fromBaseUnit, getViemClient } from '@shapeshiftoss/utils'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'
import { Connection, PublicKey } from '@solana/web3.js'

import { isNativeToken } from './assetHelpers'
import { supportsTxOperations } from './chains/helpers'

const SOLANA_RPC_URL = (() => {
  const url = process.env.VITE_SOLANA_RPC_URL
  if (!url) {
    throw new Error('VITE_SOLANA_RPC_URL environment variable is required')
  }
  return url
})()

// Solana constants (in lamports)
const SOLANA_RENT_EXEMPT_MINIMUM = 890880n // Minimum rent-exempt balance
const SOLANA_BASE_FEE = 5000n // Typical transaction fee
const SOLANA_ATA_CREATION_COST = 2039280n // Cost to create Associated Token Account

// EVM constants
const EVM_NATIVE_GAS_LIMIT = 21000n // Standard ETH transfer
const EVM_ERC20_GAS_LIMIT = 65000n // ERC20 transfer estimate
const GAS_PRICE_BUFFER_PERCENT = 20n // 20% buffer for gas price fluctuations

export async function calculateMaxSendAmount(
  asset: Asset,
  balance: string,
  from: string,
  recipient: string
): Promise<string> {
  if (!supportsTxOperations(asset.chainId)) {
    throw new Error(`Send operations are only supported for EVM and Solana chains`)
  }

  const { chainNamespace } = fromChainId(asset.chainId)

  if (chainNamespace === 'eip155') {
    return calculateMaxEvmSend(asset, balance)
  }

  return calculateMaxSolanaSend(asset, balance, from, recipient)
}

async function calculateMaxEvmSend(asset: Asset, balance: string): Promise<string> {
  const isNative = isNativeToken(asset)

  if (!isNative) {
    // ERC20: Can send full balance (gas paid in native token)
    return fromBaseUnit(balance, asset.precision)
  }

  // Native token: Must reserve gas
  const viemClient = getViemClient(asset.chainId)
  const gasPrice = await viemClient.getGasPrice()

  // Add 20% buffer for gas price fluctuations
  const gasCost = (EVM_NATIVE_GAS_LIMIT * gasPrice * (100n + GAS_PRICE_BUFFER_PERCENT)) / 100n

  const balanceBigInt = BigInt(balance)

  if (balanceBigInt <= gasCost) {
    throw new Error(
      `Insufficient balance to cover gas. Need ${fromBaseUnit(gasCost.toString(), asset.precision)} ${asset.symbol} for gas.`
    )
  }

  const maxSend = balanceBigInt - gasCost

  return fromBaseUnit(maxSend.toString(), asset.precision)
}

async function calculateMaxSolanaSend(asset: Asset, balance: string, from: string, recipient: string): Promise<string> {
  const isNative = isNativeToken(asset)

  if (isNative) {
    // SOL: Reserve rent-exempt + transaction fee
    const balanceBigInt = BigInt(balance)
    const requiredReserve = SOLANA_RENT_EXEMPT_MINIMUM + SOLANA_BASE_FEE

    if (balanceBigInt <= requiredReserve) {
      const requiredSol = fromBaseUnit(requiredReserve.toString(), 9)
      throw new Error(
        `Insufficient SOL balance to cover fees and rent-exempt minimum. Need at least ${requiredSol} SOL.`
      )
    }

    const maxSend = balanceBigInt - requiredReserve

    return fromBaseUnit(maxSend.toString(), asset.precision)
  }

  // SPL Token: Check if need to create recipient ATA
  const connection = new Connection(SOLANA_RPC_URL, 'confirmed')
  const tokenAddress = fromAssetId(asset.assetId).assetReference
  const tokenMint = new PublicKey(tokenAddress)

  let mintAccountInfo
  let tokenProgramId
  let recipientATA
  let requiredSolBalance = SOLANA_BASE_FEE

  try {
    // Detect which token program owns this mint (Token vs Token-2022)
    mintAccountInfo = await connection.getAccountInfo(tokenMint)
    if (!mintAccountInfo) {
      throw new Error(`Token mint ${tokenMint.toBase58()} not found`)
    }
    tokenProgramId = mintAccountInfo.owner

    recipientATA = getAssociatedTokenAddressSync(tokenMint, new PublicKey(recipient), false, tokenProgramId)

    const accountInfo = await connection.getAccountInfo(recipientATA)
    if (!accountInfo) {
      requiredSolBalance += SOLANA_ATA_CREATION_COST
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Token mint')) {
      throw error
    }
    throw new Error(
      `Unable to check token account - network error: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  try {
    // Check sender's SOL balance for fees
    const solBalance = await connection.getBalance(new PublicKey(from))

    if (BigInt(solBalance) < requiredSolBalance) {
      const requiredSol = fromBaseUnit(requiredSolBalance.toString(), 9)
      const ataCost = requiredSolBalance > SOLANA_BASE_FEE ? ' (including ATA creation)' : ''
      throw new Error(`Need ${requiredSol} SOL to cover transaction fees${ataCost}`)
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Need')) {
      throw error
    }
    throw new Error(
      `Unable to check SOL balance - network error: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  // Can send full token balance
  return fromBaseUnit(balance, asset.precision)
}

export function estimateEvmTransferGas(isNative: boolean): bigint {
  return isNative ? EVM_NATIVE_GAS_LIMIT : EVM_ERC20_GAS_LIMIT
}

export function estimateSolanaFee(needsAtaCreation: boolean): bigint {
  return needsAtaCreation ? SOLANA_BASE_FEE + SOLANA_ATA_CREATION_COST : SOLANA_BASE_FEE
}

export function formatEstimatedFee(chainId: string, isNative: boolean, needsAtaCreation?: boolean): string {
  const isEvm = chainId.startsWith('eip155:')

  if (isEvm) {
    return isNative ? '~0.001' : '~0.002'
  }

  if (needsAtaCreation) {
    return '~0.00244'
  }

  return '~0.000005'
}
