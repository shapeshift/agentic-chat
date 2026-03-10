import type { CowOrder } from '../../../lib/cow/types'
import type { ActiveOrderSummary } from '../../../utils/walletContextSimple'

export const NOW_SECONDS = 1700000000
export const PAST_VALID_TO = NOW_SECONDS - 3600
export const FUTURE_VALID_TO = NOW_SECONDS + 3600
export const TWAP_START_MS = (NOW_SECONDS - 7200) * 1000

export const SELL_TOKEN = '0xaaaa000000000000000000000000000000000001'
export const BUY_TOKEN = '0xbbbb000000000000000000000000000000000002'

export function createTwapOrder(overrides: Partial<ActiveOrderSummary> = {}): ActiveOrderSummary {
  return {
    orderHash: '0xorder123',
    chainId: 1,
    sellTokenAddress: SELL_TOKEN,
    sellTokenSymbol: 'SELL',
    sellAmountBaseUnit: '3000000000000000000',
    sellAmountHuman: '3.0',
    buyTokenAddress: BUY_TOKEN,
    buyTokenSymbol: 'BUY',
    buyAmountHuman: '6.0',
    strikePrice: '2.0',
    validTo: PAST_VALID_TO,
    submitTxHash: '0xtx123',
    createdAt: TWAP_START_MS,
    network: 'ethereum',
    status: 'open',
    orderType: 'twap',
    numParts: 3,
    ...overrides,
  }
}

export function createCowPartOrder(overrides: Partial<CowOrder> = {}): CowOrder {
  return {
    uid: 'cow-uid-1',
    owner: '0xsafe',
    sellToken: SELL_TOKEN,
    buyToken: BUY_TOKEN,
    sellAmount: '1000000000000000000',
    buyAmount: '2000000000000000000',
    validTo: PAST_VALID_TO,
    status: 'fulfilled',
    executedSellAmount: '1000000000000000000',
    executedBuyAmount: '2000000000000000000',
    creationDate: new Date((NOW_SECONDS - 6000) * 1000).toISOString(),
    kind: 'sell',
    partiallyFillable: false,
    class: 'limit',
    signingScheme: 'eip1271',
    ...overrides,
  }
}
