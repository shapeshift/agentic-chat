// Chainlink price feed oracle addresses per chain per token
// Required by the ComposableCoW StopLoss handler for on-chain price verification
// Only tokens with Chainlink price feeds can have stop-loss orders

import { GENERATED_ORACLES } from './generated/chainlinkFeeds'

export interface ChainlinkFeed {
  address: string
  decimals: number
}

// Sepolia only — no RDD for testnet
const SEPOLIA_ORACLES: Record<string, ChainlinkFeed> = {
  ETH: { address: '0x694AA1769357215DE4FAC081bf1f309aDC325306', decimals: 8 },
  WETH: { address: '0x694AA1769357215DE4FAC081bf1f309aDC325306', decimals: 8 },
  BTC: { address: '0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43', decimals: 8 },
  USDC: { address: '0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E', decimals: 8 },
  LINK: { address: '0xc59E3633BAAC79493d908e63626716e204A45EdF', decimals: 8 },
  DAI: { address: '0x14866185B1962B63C3Ea9E03Bc1da838bab34C19', decimals: 8 },
}

export function getChainlinkOracle(chainId: number, rawSymbol: string): ChainlinkFeed | undefined {
  const symbol = rawSymbol.toUpperCase()

  const generated = GENERATED_ORACLES[chainId]?.[symbol]
  if (generated) return generated

  if (chainId === 11155111) return SEPOLIA_ORACLES[symbol]

  return undefined
}

export function getSupportedOracleTokens(chainId: number): string[] {
  const generatedTokens = Object.keys(GENERATED_ORACLES[chainId] ?? {})
  if (chainId === 11155111) {
    return [...new Set([...generatedTokens, ...Object.keys(SEPOLIA_ORACLES)])]
  }
  return generatedTokens
}
