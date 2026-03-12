import type { AddressLookupTableAccount } from '@solana/web3.js'
import {
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js'

import { SimulationError } from '@/utils/SimulationError'

import type { TransactionParams } from '../types'

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
  if (!params.data) throw new Error('Invalid Solana transaction: missing data field')
  if (!params.from) throw new Error('Invalid Solana transaction: missing from address')

  const connection = new Connection(import.meta.env.VITE_SOLANA_RPC_URL, 'confirmed')

  try {
    const txData = JSON.parse(params.data) as unknown

    if (!isSolanaTransactionData(txData)) {
      throw new Error('Invalid Solana transaction data structure')
    }

    const signer =
      params.solanaSigner ??
      (window as { solana?: { signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction> } }).solana

    if (!signer) {
      throw new Error('No Solana wallet connected. Please connect your wallet first.')
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

    // Simulate before wallet interaction
    try {
      const { simulateSolanaTransaction } = await import('./simulation')
      await simulateSolanaTransaction(transaction, connection)
    } catch (error) {
      if (error instanceof SimulationError) throw error
      console.warn('[simulation] Solana simulation failed, proceeding without:', error)
    }

    const signedTx = await (signer.signTransaction as (tx: VersionedTransaction) => Promise<VersionedTransaction>)(
      transaction
    )
    const signature = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: true,
      preflightCommitment: 'confirmed',
      maxRetries: 3,
    })

    return signature
  } catch (error) {
    if (error instanceof SimulationError) {
      throw new Error(`Transaction will revert: ${error.message}`)
    }
    if (error instanceof SyntaxError) {
      throw new Error('Failed to parse Solana transaction data: Invalid JSON')
    }
    if (error instanceof Error) {
      throw new Error(`Solana transaction failed: ${error.message}`)
    }
    throw new Error('Solana transaction failed: Unknown error')
  }
}
