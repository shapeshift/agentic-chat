import BigNumber from 'bignumber.js'

const getCryptoNumberFractionDigits = (num: number): number => {
  const absNum = Math.abs(num)
  if (absNum >= 100000) return 1
  if (absNum >= 10000) return 2
  if (absNum >= 1000) return 3
  if (absNum >= 100) return 4
  if (absNum >= 10) return 5
  return 6
}

export type FormatCryptoAmountOptions = {
  symbol?: string
  decimals?: number
}

export function formatCryptoAmount(
  value: BigNumber.Value | null | undefined,
  options?: FormatCryptoAmountOptions
): string {
  if (value === null || value === undefined) return 'N/A'

  try {
    const bn = new BigNumber(value)
    if (!bn.isFinite()) return 'N/A'

    const num = bn.toNumber()
    if (isNaN(num)) return 'N/A'

    let formatted: string
    if (num === 0) {
      formatted = '0'
    } else if (Math.abs(num) < 0.000001) {
      formatted = num.toExponential(2)
    } else {
      const maxDecimals = options?.decimals ?? getCryptoNumberFractionDigits(num)
      const fixedStr = num.toFixed(maxDecimals)
      formatted = fixedStr.replace(/\.?0+$/, '')
    }

    return options?.symbol ? `${formatted} ${options.symbol}` : formatted
  } catch (e) {
    console.error(e)
    return 'N/A'
  }
}
