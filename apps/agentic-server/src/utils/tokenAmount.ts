import type { Asset } from '@shapeshiftoss/types'
import BigNumber from 'bignumber.js'
import { z } from 'zod'

type AmountAsset = Pick<Asset, 'symbol' | 'precision'>

export const tokenAmountSchema = z
  .string()
  .trim()
  .regex(
    /^\d+(\.\d+)?$/,
    'Use a plain decimal token amount, such as "1" or "0.5", without exponents, signs or separators.'
  )
  .refine(value => new BigNumber(value).isFinite() && new BigNumber(value).gt(0), 'Amount must be positive.')

export function tokenAmountToBaseUnit(value: string, asset: AmountAsset): string {
  const amount = new BigNumber(tokenAmountSchema.parse(value))
  if (amount.decimalPlaces()! > asset.precision) {
    throw new Error(
      `${asset.symbol} supports at most ${asset.precision} decimal places. Use a token amount without rounding.`
    )
  }
  return amount.shiftedBy(asset.precision).toFixed(0)
}

// A large integer alone is ambiguous. Only suggest a base-unit mistake when the
// token amount exceeds funds and the base-unit interpretation would fit them.
export function getBaseUnitAmountHint(value: string, asset: AmountAsset, availableBaseUnit: string): string {
  const amount = new BigNumber(value)
  const available = new BigNumber(availableBaseUnit)
  if (
    asset.precision <= 0 ||
    !amount.isInteger() ||
    !amount.gt(0) ||
    amount.gt(available) ||
    amount.shiftedBy(asset.precision).lte(available)
  )
    return ''

  const converted = amount.shiftedBy(-asset.precision).toFixed()
  return (
    ` This may be a base-unit amount: ${amount.toFixed()} base units = ${converted} ${asset.symbol}. ` +
    `Amounts must be in token units. Ask the user to clarify the amount; do not automatically rescale it.`
  )
}

export function assertSufficientTokenBalance(value: string, asset: AmountAsset, availableBaseUnit: string): void {
  const required = tokenAmountToBaseUnit(value, asset)
  if (new BigNumber(required).lte(availableBaseUnit)) return

  const available = new BigNumber(availableBaseUnit).shiftedBy(-asset.precision).toFixed()
  throw new Error(
    `Insufficient ${asset.symbol} balance. Required: ${value}, Available: ${available}` +
      getBaseUnitAmountHint(value, asset, availableBaseUnit)
  )
}
