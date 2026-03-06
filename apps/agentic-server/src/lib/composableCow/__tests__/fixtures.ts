import { keccak256, encodeAbiParameters, parseAbiParameters } from 'viem'

import { toChecksumAddress } from '../../../utils/addressValidation'
import type { StopLossStaticData, TwapStaticData } from '../index'

export const ADDRESSES = {
  WETH: toChecksumAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'),
  USDC: toChecksumAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'),
  DAI: toChecksumAddress('0x6B175474E89094C44Da98b954EedeAC495271d0F'),
  SAFE: toChecksumAddress('0xcFD4f9b00935A660283987d8Ec1011c27d8F8fDe'),
  ETH_USD_ORACLE: toChecksumAddress('0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419'),
  USDC_USD_ORACLE: toChecksumAddress('0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6'),
} as const

export const APP_DATA = '0x0000000000000000000000000000000000000000000000000000000000000000' as const

export const STOP_LOSS_FIXTURE: StopLossStaticData = {
  sellToken: ADDRESSES.WETH,
  buyToken: ADDRESSES.USDC,
  sellAmount: 1000000000000000000n, // 1 WETH
  buyAmount: 3000000000n, // 3000 USDC (6 decimals)
  appData: APP_DATA,
  receiver: ADDRESSES.SAFE,
  isSellOrder: true,
  isPartiallyFillable: false,
  validTo: 1735689600, // 2025-01-01 00:00:00 UTC
  sellTokenPriceOracle: ADDRESSES.ETH_USD_ORACLE,
  buyTokenPriceOracle: ADDRESSES.USDC_USD_ORACLE,
  strike: 300000000000n, // arbitrary test value (production uses triggerPrice/buyPrice * 1e18)
  maxTimeSinceLastOracleUpdate: 3600n, // 1 hour
}

export const TWAP_FIXTURE: TwapStaticData = {
  sellToken: ADDRESSES.USDC,
  buyToken: ADDRESSES.WETH,
  receiver: ADDRESSES.SAFE,
  partSellAmount: 10000000n, // 10 USDC per part (6 decimals)
  minPartLimit: 1n, // minimum 1 wei WETH per part
  t0: 0n, // start immediately
  n: 10n, // 10 parts
  t: 3600n, // 1 hour between trades
  span: 0n, // full interval
  appData: APP_DATA,
}

export const DETERMINISTIC_SALT = keccak256(
  encodeAbiParameters(parseAbiParameters('address, address, address, uint256'), [
    ADDRESSES.SAFE,
    ADDRESSES.WETH,
    ADDRESSES.USDC,
    12345n,
  ])
)

export const FUNCTION_SELECTORS = {
  create: '0x6bfae1ca',
  createWithContext: '0x0d0d9800',
  remove: '0x95bc2673',
} as const

export function createStopLossData(overrides: Partial<StopLossStaticData> = {}): StopLossStaticData {
  return { ...STOP_LOSS_FIXTURE, ...overrides }
}

export function createTwapData(overrides: Partial<TwapStaticData> = {}): TwapStaticData {
  return { ...TWAP_FIXTURE, ...overrides }
}
