// Decimal precision constants for different token standards

export const PRECISION_HIGH = 18 // Default for most tokens (EVM standard)
export const PRECISION_MEDIUM = 9 // Alternative precision used by some chains

// Native decimals for specific chains
export const EVM_NATIVE_DECIMALS = 18
export const SOLANA_NATIVE_DECIMALS = 9

// Fetch limits
export const MAX_LIMITED_FETCH_COUNT = 200

// 4-byte function selectors for well-known DEX swap methods
export const KNOWN_SWAP_SELECTORS = new Set<string>([
  // Uniswap V2 Router
  '0x38ed1739', // swapExactTokensForTokens
  '0x8803dbee', // swapTokensForExactTokens
  '0x7ff36ab5', // swapExactETHForTokens
  '0x4a25d94a', // swapTokensForExactETH
  '0x18cbafe5', // swapExactTokensForETH
  '0xfb3bdb41', // swapETHForExactTokens
  // Uniswap V3 SwapRouter
  '0x414bf389', // exactInputSingle
  '0xc04b8d59', // exactInput
  '0xdb3e2198', // exactOutputSingle
  '0xf28c0498', // exactOutput
  // Uniswap Universal Router
  '0x3593564c', // execute
  '0x24856bc3', // execute (deadline variant)
  // 1inch AggregationRouterV5/V6
  '0x12aa3caf', // swap
  '0xe449022e', // uniswapV3Swap
  '0x0502b1c5', // unoswap
  '0xf78dc253', // unoswapTo
  // 0x Exchange Proxy
  '0xd9627aa4', // sellToUniswap
  '0x415565b0', // transformERC20
  // CowSwap GPv2Settlement
  '0x13d79a0b', // settle
  // Paraswap
  '0x54e3f31b', // simpleSwap
  '0xa94e78ef', // multiSwap
  '0x46c67b6d', // megaSwap
  // THORChain Router
  '0x44bc937b', // depositWithExpiry
  '0x1fece7b4', // deposit
])
