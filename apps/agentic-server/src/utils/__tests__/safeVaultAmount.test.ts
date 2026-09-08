import type { Asset } from '@shapeshiftoss/types'
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'

import * as balanceHelpers from '../balanceHelpers'
import * as committedBalances from '../committedBalances'
import { calculateSafeVaultDeposit } from '../safeVaultDeposit'

const safeAddress = '0x0000000000000000000000000000000000000001'
const walletAddress = '0x0000000000000000000000000000000000000002'
const tokenAddress = '0x0000000000000000000000000000000000000003'
const asset = { symbol: 'USDC', precision: 6, chainId: 'eip155:1', assetId: `eip155:1/erc20:${tokenAddress}` } as Asset
let getBalance: ReturnType<typeof spyOn<typeof balanceHelpers, 'getBalance'>>
let getCommitted: ReturnType<typeof spyOn<typeof committedBalances, 'getCommittedAmountForToken'>>

beforeEach(() => {
  getBalance = spyOn(balanceHelpers, 'getBalance')
  getCommitted = spyOn(committedBalances, 'getCommittedAmountForToken')
})

afterEach(() => {
  getBalance.mockRestore()
  getCommitted.mockRestore()
})

const createOrder = (sellAmountBaseUnit: string) =>
  calculateSafeVaultDeposit({
    walletContext: { connectedWallets: { 'eip155:1': { address: walletAddress } } },
    safeAddress,
    sellAsset: asset,
    sellAmountBaseUnit,
    evmChainId: 1,
    sellTokenAddress: tokenAddress,
  })

describe('Safe order amount checks', () => {
  test('counts only uncommitted Safe funds plus wallet funds', async () => {
    getCommitted.mockResolvedValue(200_000000n)
    getBalance.mockImplementation(address => Promise.resolve(address === safeAddress ? '600000000' : '600000000'))
    const result = await createOrder('1000000000')
    expect(result.depositAmount).toBe(600_000000n)
    expect(result.totalNeeded).toBe(1200_000000n)
  })

  test('rejects a USDC base-unit mistake using the combined available funds', async () => {
    getCommitted.mockResolvedValue(200_000000n)
    getBalance.mockResolvedValue('600000000')
    const error = await createOrder('1000000000000000').catch((error: unknown) => error)
    expect(error).toBeInstanceOf(Error)
    expect(String(error)).toContain('1000000000 base units = 1000 USDC')
  })
})
