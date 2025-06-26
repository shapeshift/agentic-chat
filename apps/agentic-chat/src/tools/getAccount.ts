import { fromBaseUnit } from '@shapeshiftoss/utils'
import axios from 'axios'
import type { Address } from 'viem'

import type { Account } from '../types/account'

export const getAccount = async (address: Address | undefined, network: string) => {
  if (!address) {
    throw new Error('No account connected')
  }

  const baseUrl = import.meta.env[`VITE_UNCHAINED_${network.toUpperCase()}_HTTP_URL`]

  const { data } = await axios.get<Account>(`${baseUrl}/api/v1/account/${address}`)

  const nativeBalance = fromBaseUnit(
    data.balance,
    18 // assume 18 decimals for all native EVM tokens
  )

  const tokensBalances = data.tokens.map(token => ({
    ...token,
    balance: fromBaseUnit(token.balance, token.decimals),
  }))

  return { nativeBalance, tokensBalances }
}
