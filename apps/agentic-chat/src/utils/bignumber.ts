import BigNumber from 'bignumber.js';

export const fromBaseUnit = (
  value: string | number | BigNumber,
  precision: number
): string => {
  const bn = new BigNumber(value);
  return bn.dividedBy(new BigNumber(10).pow(precision)).toString();
};

export const toBaseUnit = (
  value: string | number | BigNumber,
  precision: number
): string => {
  const bn = new BigNumber(value);
  return bn.multipliedBy(new BigNumber(10).pow(precision)).toString();
}; 