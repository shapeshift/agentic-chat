const STABLECOIN_SYMBOLS = new Set([
  'USDC',
  'USDT',
  'DAI',
  'XDAI',
  'FRAX',
  'LUSD',
  'GUSD',
  'USDP',
  'TUSD',
  'BUSD',
  'PYUSD',
  'USDS',
  'USDE',
  'GHO',
  'CRVUSD',
  'EUSD',
])

export function isStablecoin(symbol: string): boolean {
  return STABLECOIN_SYMBOLS.has(symbol.toUpperCase())
}
