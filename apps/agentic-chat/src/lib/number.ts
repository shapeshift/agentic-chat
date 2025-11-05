export type NumberValue = number | string

const toNumber = (value: NumberValue): number => {
  if (typeof value === 'number') return value
  return Number(value) || 0
}

const getFiatNumberFractionDigits = (num: number): number => {
  if (num >= 1 || 0.000001 > num) return 0
  if (1 > num && num >= 0.1) return 3
  if (0.1 > num && num >= 0.01) return 4
  if (0.01 > num && num >= 0.001) return 5
  if (0.001 > num && num >= 0.0001) return 6
  if (0.0001 > num && num >= 0.00001) return 7
  if (0.00001 > num && num >= 0.000001) return 8
  return 0
}

export type NumberFormatOptions = {
  maximumFractionDigits?: number
  minimumFractionDigits?: number
  notation?: 'compact' | 'standard' | 'scientific' | 'engineering'
  omitDecimalTrailingZeros?: boolean
}

const partsReducer = (maximumFractionDigits: number, omitDecimalTrailingZeros?: boolean) => {
  return (accum: string, { type, value }: Intl.NumberFormatPart) => {
    let segment = value
    if (type === 'decimal' && maximumFractionDigits === 0) segment = ''
    if (type === 'fraction') {
      segment = value.substring(0, maximumFractionDigits)
      if (omitDecimalTrailingZeros && segment && /^0*$/.test(segment)) {
        return accum.slice(0, -1)
      }
    }
    return accum + segment
  }
}

const abbreviateNumber = (
  number: number,
  locale = 'en-US',
  currency?: string,
  options?: NumberFormatOptions
): string => {
  const bounds = { min: 10000, max: 1000000 }
  const longCompactDisplayLowerBound = 1_000_000_000
  const noDecimals = bounds.min <= number && number < bounds.max
  const minDisplayValue = 0.000001
  const lessThanMin = 0 < number && minDisplayValue > number
  const formatNumber = lessThanMin ? minDisplayValue : number
  const minimumFractionDigits = noDecimals ? 0 : 2
  const maximumFractionDigits = Math.max(minimumFractionDigits, lessThanMin ? 6 : getFiatNumberFractionDigits(number))

  const filteredOptions = options
    ? Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined))
    : {}

  const formatter = new Intl.NumberFormat(locale, {
    notation: number < bounds.min || noDecimals ? 'standard' : 'compact',
    compactDisplay: currency || number < longCompactDisplayLowerBound ? 'short' : 'long',
    style: currency ? 'currency' : 'decimal',
    currency,
    minimumFractionDigits,
    maximumFractionDigits: 10,
    ...filteredOptions,
  })

  const parts = formatter.formatToParts(formatNumber)
  return parts.reduce(partsReducer(maximumFractionDigits, options?.omitDecimalTrailingZeros), lessThanMin ? '<' : '')
}

export function formatFiat(value: NumberValue | null | undefined, options?: NumberFormatOptions): string {
  if (value === null || value === undefined) return 'N/A'
  try {
    const number = toNumber(value)
    if (isNaN(number)) return 'N/A'
    return abbreviateNumber(number, 'en-US', 'USD', options)
  } catch (e) {
    console.error(e)
    return 'N/A'
  }
}

export function formatCompactNumber(value: NumberValue | null | undefined, options?: NumberFormatOptions): string {
  if (value === null || value === undefined) return 'N/A'
  try {
    const number = toNumber(value)
    if (isNaN(number)) return 'N/A'
    return abbreviateNumber(number, 'en-US', undefined, options)
  } catch (e) {
    console.error(e)
    return 'N/A'
  }
}

export function formatPercent(value: NumberValue | null | undefined, options: NumberFormatOptions = {}): string {
  if (value === null || value === undefined) return 'N/A'
  try {
    const number = toNumber(value)
    if (isNaN(number)) return 'N/A'
    return number.toLocaleString('en-US', {
      style: 'percent',
      minimumIntegerDigits: 1,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...options,
    })
  } catch (e) {
    console.error(e)
    return 'N/A'
  }
}
