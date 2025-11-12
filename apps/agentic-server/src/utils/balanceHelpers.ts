import type { Asset } from '@shapeshiftoss/types'
import { chainIdToNetwork } from '@shapeshiftoss/types'
import { fromBaseUnit, toBaseUnit } from '@shapeshiftoss/utils'

import { executeGetAccount } from '../tools/getAccount'

export async function getBalance(address: string, asset: Asset): Promise<string> {
  const network = chainIdToNetwork[asset.chainId] ?? 'ethereum'
  const accountData = await executeGetAccount({
    account: address,
    network,
  })
  return accountData.balances[asset.assetId] || '0'
}

export async function validateSufficientBalance(address: string, asset: Asset, requiredAmount: string): Promise<void> {
  const balance = await getBalance(address, asset)
  const requiredAmountBaseUnit = toBaseUnit(requiredAmount, asset.precision)

  if (BigInt(balance) < BigInt(requiredAmountBaseUnit)) {
    const available = fromBaseUnit(balance, asset.precision)
    throw new Error(`Insufficient ${asset.symbol} balance. Required: ${requiredAmount}, Available: ${available}`)
  }
}
