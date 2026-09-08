import type { Asset } from '@shapeshiftoss/types'
import { chainIdToNetwork } from '@shapeshiftoss/types'

import { executeGetAccount } from '../tools/getAccount'

import { assertSufficientTokenBalance } from './tokenAmount'

export async function getBalance(address: string, asset: Asset): Promise<string> {
  const network = chainIdToNetwork[asset.chainId] ?? 'ethereum'

  const accountData = await executeGetAccount({
    address,
    network,
  })

  return accountData.balances[asset.assetId] || '0'
}

export async function validateSufficientBalance(address: string, asset: Asset, requiredAmount: string): Promise<void> {
  const balance = await getBalance(address, asset)

  assertSufficientTokenBalance(requiredAmount, asset, balance)
}
