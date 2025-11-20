import type BigNumber from 'bignumber.js'
import type { ReactNode } from 'react'

import { bnOrZero } from '@/lib/bignumber'
import { formatCryptoAmount, formatFiat, formatPercent } from '@/lib/number'
import { cn } from '@/lib/utils'

type AmountValue = BigNumber.Value | null | undefined

type BaseAmountProps = {
  value: AmountValue
  prefix?: ReactNode
  suffix?: ReactNode
  className?: string
}

type CryptoAmountProps = BaseAmountProps & {
  symbol?: string
  decimals?: number
}

type FiatAmountProps = BaseAmountProps & {
  autoColor?: boolean
  showSign?: boolean
}

type PercentAmountProps = BaseAmountProps & {
  autoColor?: boolean
  showSign?: boolean
}

function Crypto({ value, symbol, decimals, prefix, suffix, className }: CryptoAmountProps) {
  const formatted = formatCryptoAmount(value, { symbol, decimals })

  return (
    <span className={cn('tabular-nums', className)}>
      {prefix && <>{prefix} </>}
      {formatted}
      {suffix && <> {suffix}</>}
    </span>
  )
}

function Fiat({ value, autoColor, showSign, prefix, suffix, className }: FiatAmountProps) {
  const num = bnOrZero(value)
  const formatted = formatFiat(num.abs())
  const sign = showSign ? (num.gte(0) ? '+' : '-') : undefined

  const colorClass = (() => {
    if (!autoColor) return undefined
    if (num.gt(0)) return 'text-green-500'
    if (num.lt(0)) return 'text-red-500'
    return undefined
  })()

  return (
    <span className={cn('tabular-nums', colorClass, className)}>
      {prefix && <>{prefix} </>}
      {sign}
      {formatted}
      {suffix && <> {suffix}</>}
    </span>
  )
}

function Percent({ value, autoColor, showSign, prefix, suffix, className }: PercentAmountProps) {
  const num = bnOrZero(value)
  const formatted = formatPercent(num.abs())
  const sign = showSign ? (num.gte(0) ? '+' : '-') : undefined

  const colorClass = (() => {
    if (!autoColor) return undefined
    if (num.gt(0)) return 'text-green-500'
    if (num.lt(0)) return 'text-red-500'
    return undefined
  })()

  return (
    <span className={cn('tabular-nums', colorClass, className)}>
      {prefix && <>{prefix} </>}
      {sign}
      {formatted}
      {suffix && <> {suffix}</>}
    </span>
  )
}

export const Amount = {
  Crypto,
  Fiat,
  Percent,
}
