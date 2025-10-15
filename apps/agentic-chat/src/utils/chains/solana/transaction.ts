import type { AddressLookupTableAccount } from '@solana/web3.js'
import {
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js'

import type { TransactionParams } from '../types'

const SOLANA_RPC_URL = (() => {
  // Try VITE_ prefixed first (primary), fallback to non-prefixed (backwards compat)
  const url = import.meta.env.VITE_SOLANA_RPC_URL || import.meta.env.SOLANA_RPC_URL
  if (!url) {
    throw new Error('VITE_SOLANA_RPC_URL environment variable is not set')
  }
  return url as string
})()

interface SolanaTransactionData {
  instructions: Array<{
    keys: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>
    data: string
    programId: string
  }>
  addressLookupTableAddresses?: string[]
}

const isSolanaTransactionData = (data: unknown): data is SolanaTransactionData => {
  return (
    typeof data === 'object' &&
    data !== null &&
    'instructions' in data &&
    Array.isArray((data as SolanaTransactionData).instructions)
  )
}

export async function sendSolanaTransaction(params: TransactionParams): Promise<string> {
  if (!window.solana) {
    throw new Error('No Solana wallet connected. Please connect your wallet first.')
  }

  const connection = new Connection(SOLANA_RPC_URL, 'confirmed')

  try {
    const txData = JSON.parse(params.data) as unknown

    if (!isSolanaTransactionData(txData)) {
      throw new Error('Invalid Solana transaction data structure')
    }

    const instructions = txData.instructions.map(
      ix =>
        new TransactionInstruction({
          keys: ix.keys.map(key => ({
            pubkey: new PublicKey(key.pubkey),
            isSigner: key.isSigner,
            isWritable: key.isWritable,
          })),
          programId: new PublicKey(ix.programId),
          data: Buffer.from(ix.data, 'hex'),
        })
    )

    const { blockhash } = await connection.getLatestBlockhash('confirmed')

    let addressLookupTableAccounts: AddressLookupTableAccount[] = []
    if (txData.addressLookupTableAddresses && txData.addressLookupTableAddresses.length > 0) {
      const lookupTableAccountInfos = await Promise.all(
        txData.addressLookupTableAddresses.map(address => connection.getAddressLookupTable(new PublicKey(address)))
      )
      addressLookupTableAccounts = lookupTableAccountInfos
        .map(res => res.value)
        .filter((account): account is AddressLookupTableAccount => account !== null)
    }

    const messageV0 = new TransactionMessage({
      payerKey: new PublicKey(params.from),
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message(addressLookupTableAccounts)

    const transaction = new VersionedTransaction(messageV0)

    const signedTx = await window.solana.signTransaction(transaction)
    const signature = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 3,
    })

    return signature
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Failed to parse Solana transaction data: Invalid JSON')
    }
    if (error instanceof Error) {
      throw new Error(`Solana transaction failed: ${error.message}`)
    }
    throw new Error('Solana transaction failed: Unknown error')
  }
}
