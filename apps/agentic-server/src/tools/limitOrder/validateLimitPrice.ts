import type { Asset } from '@shapeshiftoss/types'
import BigNumber from 'bignumber.js'

type PricedAsset = Pick<Asset, 'symbol' | 'price'>

export function validateLimitPrice(
  value: string,
  sellAsset: PricedAsset,
  buyAsset: PricedAsset,
  priceConfirmed = false
): void {
  const price = new BigNumber(value)
  if (!price.isFinite() || !price.gt(0)) {
    throw new Error(`Invalid limitPrice "${value}". It must be a positive number.`)
  }

  const sellUsd = new BigNumber(sellAsset.price ?? '0')
  const buyUsd = new BigNumber(buyAsset.price ?? '0')
  // Missing prices cannot establish an inversion. Basic validation still applies.
  if (!sellUsd.isFinite() || !buyUsd.isFinite() || !sellUsd.gt(0) || !buyUsd.gt(0)) return

  // Cross-multiply comparisons to avoid rounding very small pair prices to zero.
  const targetSellUsd = price.times(buyUsd)
  const materiallyDifferent = targetSellUsd.gte(sellUsd.times(2)) || targetSellUsd.lte(sellUsd.times('0.5'))
  const nearInverse = price.times(sellUsd).minus(buyUsd).abs().lte(buyUsd.times('0.1'))
  const farFromMarket = targetSellUsd.gt(sellUsd.times(10)) || targetSellUsd.lt(sellUsd.times('0.1'))
  const nearUsdPrice = [sellUsd, buyUsd].some(usd => price.minus(usd).abs().lte(usd.times('0.25')))

  let reason: string
  if (materiallyDifferent && nearInverse) {
    reason = 'looks like an inverted pair price'
  } else if (farFromMarket && nearUsdPrice) {
    reason = 'looks like a USD token price rather than a pair price'
  } else if (farFromMarket) {
    reason = 'differs from the current pair price by more than 10×'
  } else {
    return
  }

  if (priceConfirmed) return

  const Price = BigNumber.clone({ DECIMAL_PLACES: 80 })
  const marketPrice = new Price(sellUsd).div(buyUsd).toPrecision(8)
  throw new Error(
    `limitPrice ${value} ${buyAsset.symbol}/${sellAsset.symbol} ${reason}. ` +
      `The current market rate is approximately ${marketPrice} ${buyAsset.symbol} per 1 ${sellAsset.symbol}. ` +
      `Ask the user to confirm the exact target in ${buyAsset.symbol} per 1 ${sellAsset.symbol}; do not silently change it. ` +
      `Only after explicit confirmation, retry with that target and priceConfirmed=true.`
  )
}
