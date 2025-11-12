import { fromAssetId } from '@shapeshiftoss/caip'
import type { Asset } from '@shapeshiftoss/types'
import { toBaseUnit } from '@shapeshiftoss/utils'
import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { Connection, PublicKey, SystemProgram } from '@solana/web3.js'
import { encodeFunctionData, erc20Abi, getAddress } from 'viem'

import type { TransactionData } from '../lib/schemas/swapSchemas'

export function createTransaction(tx: {
  chainId: string | number
  data: string
  from: string
  to: string
  value: string
  gasLimit?: string
}): TransactionData {
  return {
    chainId: String(tx.chainId),
    data: tx.data || '',
    from: tx.from,
    to: tx.to,
    value: tx.value,
    ...(tx.gasLimit && { gasLimit: tx.gasLimit }),
  }
}

export function buildEvmNativeTransfer(asset: Asset, from: string, to: string, amount: string): TransactionData {
  const value = toBaseUnit(amount, asset.precision)

  return createTransaction({
    chainId: asset.chainId,
    data: '0x',
    from: getAddress(from),
    to: getAddress(to),
    value,
    gasLimit: '21000',
  })
}

export function buildEvmTokenTransfer(asset: Asset, from: string, to: string, amount: string): TransactionData {
  const tokenAddress = fromAssetId(asset.assetId).assetReference

  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [getAddress(to), BigInt(toBaseUnit(amount, asset.precision))],
  })

  return createTransaction({
    chainId: asset.chainId,
    data,
    from: getAddress(from),
    to: getAddress(tokenAddress),
    value: '0',
    gasLimit: '65000',
  })
}

export async function buildSolanaTransfer(
  asset: Asset,
  from: string,
  to: string,
  amount: string,
  rpcUrl: string
): Promise<TransactionData & { needsAtaCreation?: boolean }> {
  const isNative = asset.assetId === 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/slip44:501'

  if (isNative) {
    return buildSolanaNativeTransfer(asset, from, to, amount)
  }

  return buildSolanaSplTransfer(asset, from, to, amount, rpcUrl)
}

function buildSolanaNativeTransfer(asset: Asset, from: string, to: string, amount: string): TransactionData {
  const instruction = SystemProgram.transfer({
    fromPubkey: new PublicKey(from),
    toPubkey: new PublicKey(to),
    lamports: BigInt(toBaseUnit(amount, asset.precision)),
  })

  const data = JSON.stringify({
    instructions: [
      {
        programId: instruction.programId.toBase58(),
        keys: instruction.keys.map(key => ({
          pubkey: key.pubkey.toBase58(),
          isSigner: key.isSigner,
          isWritable: key.isWritable,
        })),
        data: instruction.data.toString('hex'),
      },
    ],
  })

  return createTransaction({
    chainId: asset.chainId,
    data,
    from,
    to: '',
    value: '0',
  })
}

async function buildSolanaSplTransfer(
  asset: Asset,
  from: string,
  to: string,
  amount: string,
  rpcUrl: string
): Promise<TransactionData & { needsAtaCreation?: boolean }> {
  const connection = new Connection(rpcUrl, 'confirmed')
  const tokenAddress = fromAssetId(asset.assetId).assetReference
  const tokenMint = new PublicKey(tokenAddress)

  // Detect which token program owns this mint (Token vs Token-2022)
  const mintAccountInfo = await connection.getAccountInfo(tokenMint)
  if (!mintAccountInfo) {
    throw new Error(`Token mint ${tokenMint.toBase58()} not found`)
  }

  const isToken2022 = mintAccountInfo.owner.toString() === TOKEN_2022_PROGRAM_ID.toString()
  const tokenProgramId = isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID

  const senderATA = getAssociatedTokenAddressSync(tokenMint, new PublicKey(from), false, tokenProgramId)
  const recipientATA = getAssociatedTokenAddressSync(tokenMint, new PublicKey(to), false, tokenProgramId)

  // Check if recipient ATA exists
  const accountInfo = await connection.getAccountInfo(recipientATA)
  const needsAtaCreation = !accountInfo

  const instructions = []

  // Create recipient ATA if needed (sender pays)
  if (needsAtaCreation) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        new PublicKey(from), // Payer
        recipientATA, // ATA address
        new PublicKey(to), // Owner
        tokenMint, // Mint
        tokenProgramId // Program ID
      )
    )
  }

  // Add transfer instruction - different for Token-2022 vs regular SPL tokens
  if (isToken2022) {
    // Token-2022 requires createTransferCheckedInstruction with mint and decimals
    // Get decimals from on-chain parsed mint data
    const parsedMintInfo = await connection.getParsedAccountInfo(tokenMint)
    const onChainDecimals =
      parsedMintInfo?.value?.data &&
      typeof parsedMintInfo.value.data === 'object' &&
      'parsed' in parsedMintInfo.value.data
        ? parsedMintInfo.value.data.parsed?.info?.decimals
        : undefined
    const decimals = typeof onChainDecimals === 'number' ? onChainDecimals : asset.precision

    if (typeof onChainDecimals === 'number' && onChainDecimals !== asset.precision) {
      console.warn(`Decimals mismatch for ${asset.symbol}: on-chain=${onChainDecimals}, metadata=${asset.precision}`)
    }

    instructions.push(
      createTransferCheckedInstruction(
        senderATA,
        tokenMint, // Mint required for Token-2022
        recipientATA,
        new PublicKey(from), // Authority
        BigInt(toBaseUnit(amount, decimals)),
        decimals, // Decimals required for Token-2022
        [],
        tokenProgramId
      )
    )
  } else {
    // Regular SPL tokens use simpler createTransferInstruction
    instructions.push(
      createTransferInstruction(
        senderATA,
        recipientATA,
        new PublicKey(from), // Authority
        BigInt(toBaseUnit(amount, asset.precision)),
        [],
        tokenProgramId
      )
    )
  }

  const data = JSON.stringify({
    instructions: instructions.map(ix => ({
      programId: ix.programId.toBase58(),
      keys: ix.keys.map(key => ({
        pubkey: key.pubkey.toBase58(),
        isSigner: key.isSigner,
        isWritable: key.isWritable,
      })),
      data: ix.data.toString('hex'),
    })),
  })

  return {
    ...createTransaction({
      chainId: asset.chainId,
      data,
      from,
      to: '',
      value: '0',
    }),
    needsAtaCreation,
  }
}
