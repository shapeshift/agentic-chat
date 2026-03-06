// Chainlink price feed oracle addresses per chain per token
// Required by the ComposableCoW StopLoss handler for on-chain price verification
// Only tokens with Chainlink price feeds can have stop-loss orders

import { GENERATED_ORACLES } from './generated/chainlinkFeeds'

export interface ChainlinkFeed {
  address: string
  decimals: number
}

export function getChainlinkOracle(chainId: number, rawSymbol: string): ChainlinkFeed | undefined {
  const symbol = rawSymbol.toUpperCase()
  return GENERATED_ORACLES[chainId]?.[symbol]
}

export function getSupportedOracleTokens(chainId: number): string[] {
  return Object.keys(GENERATED_ORACLES[chainId] ?? {})
}
