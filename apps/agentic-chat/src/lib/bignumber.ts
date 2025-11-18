import BigNumber from 'bignumber.js'

export const bn = (value: BigNumber.Value): BigNumber => new BigNumber(value)

export const bnOrZero = (value: BigNumber.Value | null | undefined): BigNumber => {
  if (value === null || value === undefined || value === '') return new BigNumber(0)
  try {
    const bigNumber = new BigNumber(value)
    return bigNumber.isFinite() ? bigNumber : new BigNumber(0)
  } catch {
    return new BigNumber(0)
  }
}
