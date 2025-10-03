import { ASSET_NAMESPACE, type AssetId, type ChainId, toAssetId } from '@shapeshiftoss/caip'
import { getFeeAssetIdByChainId, getSolanaConnection } from '@shapeshiftoss/utils'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { PublicKey } from '@solana/web3.js'

interface SolanaAccountResult {
  balances: Record<AssetId, string>
}

export const getSolanaAccount = async (address: string, chainId: ChainId): Promise<SolanaAccountResult> => {
  const connection = getSolanaConnection(chainId)
  const publicKey = new PublicKey(address)

  const balances: Record<AssetId, string> = {}

  const solBalance = await connection.getBalance(publicKey)
  const feeAssetId = getFeeAssetIdByChainId(chainId)
  if (feeAssetId) {
    balances[feeAssetId] = solBalance.toString()
  }

  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
    programId: TOKEN_PROGRAM_ID,
  })

  for (const { account } of tokenAccounts.value) {
    const parsed = account.data.parsed
    if (parsed && parsed.type === 'account') {
      const mintAddress = parsed.info.mint
      const tokenAmount = parsed.info.tokenAmount
      const balance = tokenAmount.amount

      if (balance && balance !== '0') {
        const assetId = toAssetId({
          chainId,
          assetNamespace: ASSET_NAMESPACE.splToken,
          assetReference: mintAddress,
        })
        balances[assetId] = balance
      }
    }
  }

  return { balances }
}
