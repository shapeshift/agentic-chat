// Chainlink price feed oracle addresses per chain per token
// Required by the ComposableCoW StopLoss handler for on-chain price verification
// Only tokens with Chainlink price feeds can have stop-loss orders

export interface ChainlinkFeed {
  address: string
  decimals: number
}

// RDD entry shape (subset of fields we use)
interface RddEntry {
  name: string
  proxyAddress: string
  decimals: number
  feedType: string
  docs?: {
    assetClass?: string
    baseAsset?: string
    quoteAsset?: string
    productType?: string
    hidden?: boolean
  }
}

const RDD_URLS: Record<number, string> = {
  1: 'https://reference-data-directory.vercel.app/feeds-mainnet.json',
  42161: 'https://reference-data-directory.vercel.app/feeds-ethereum-mainnet-arbitrum-1.json',
  100: 'https://reference-data-directory.vercel.app/feeds-xdai-mainnet.json',
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

// Map base symbols to their wrapped ERC20 equivalents
const SYMBOL_ALIASES: Record<string, string[]> = {
  ETH: ['WETH'],
  BTC: ['WBTC'],
}

// Hardcoded fallback for when RDD fetch fails
const FALLBACK_ORACLES: Record<number, Record<string, ChainlinkFeed>> = {
  // Ethereum Mainnet
  1: {
    ETH: { address: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', decimals: 8 },
    WETH: { address: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', decimals: 8 },
    BTC: { address: '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c', decimals: 8 },
    WBTC: { address: '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c', decimals: 8 },
    USDC: { address: '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6', decimals: 8 },
    USDT: { address: '0x3E7d1eAB13ad0104d2750B8863b489D65364e32D', decimals: 8 },
    DAI: { address: '0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9', decimals: 8 },
    LINK: { address: '0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c', decimals: 8 },
    UNI: { address: '0x553303d460EE0afB37EdFf9bE42922D8FF63220e', decimals: 8 },
    AAVE: { address: '0x547a514d5e3769680Ce22B2361c10Ea13619e8a9', decimals: 8 },
    SNX: { address: '0xDC3EA94CD0AC27d9A86C180091e7f78C683d3699', decimals: 8 },
    COMP: { address: '0xdbd020CAeF83eFd542f4De03e3cF0C28A4428bd5', decimals: 8 },
    MKR: { address: '0xec1D1B3b0443256cc3860e24a46F108e699484Aa', decimals: 8 },
    CRV: { address: '0xCd627aA160A6fA45Eb793D19Ef54f5062F20f33f', decimals: 8 },
    SUSHI: { address: '0xCc70F09A6CC17553b2E31954cD36E4A2d89501f7', decimals: 8 },
    YFI: { address: '0xA027702dbb89fbd58938e4324eC63212874be5a82f8', decimals: 8 },
    BAL: { address: '0xdF2917806E30300537aEB49A7663062F4d1F2b5F', decimals: 8 },
    GNO: { address: '0x4AFe3Ec1c1FC4136eb740D1704C1bC8EE5cF6b17', decimals: 8 },
  },
  // Arbitrum One
  42161: {
    ETH: { address: '0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612', decimals: 8 },
    WETH: { address: '0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612', decimals: 8 },
    BTC: { address: '0x6ce185860a4963106506C203335A2910413708e9', decimals: 8 },
    WBTC: { address: '0xd0C7101eACbB49F3deCcCc166d238410D6D46d57', decimals: 8 },
    USDC: { address: '0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3', decimals: 8 },
    'USDC.e': { address: '0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3', decimals: 8 },
    USDT: { address: '0x3f3f5dF88dC9F13eac63DF89EC16ef6e7E25DdE7', decimals: 8 },
    USDT0: { address: '0x3f3f5dF88dC9F13eac63DF89EC16ef6e7E25DdE7', decimals: 8 },
    DAI: { address: '0xc5C8E77B397E531B8EC06BFb0048328B30E9eCfB', decimals: 8 },
    LINK: { address: '0x86E53CF1B870786351Da77A57575e79CB55812CB', decimals: 8 },
    UNI: { address: '0x9C917083fDb403ab5ADbEC26Ee294f6EcAda2720', decimals: 8 },
    AAVE: { address: '0xaD1d5344AaDE45F43E596773Bcc4c423EAbdD034', decimals: 8 },
    GMX: { address: '0xDB98056FecFff59D032aB628337A4887110df3dB', decimals: 8 },
    ARB: { address: '0xb2A824043730FE05F3DA2efaFa1CBbe83fa548D6', decimals: 8 },
    GNS: { address: '0xE89E98CE4E19071E59Ed4780E0598b541CE76486', decimals: 8 },
  },
  // Gnosis Chain
  100: {
    ETH: { address: '0xa767f745331D267c7751297D982b050c93985627', decimals: 8 },
    WETH: { address: '0xa767f745331D267c7751297D982b050c93985627', decimals: 8 },
    BTC: { address: '0x6C1d7e76EF7304a40e8456ce883BC56d3dEA3F7d', decimals: 8 },
    WXDAI: { address: '0x678df3415fc31947dA4324eC63212874be5a82f8', decimals: 8 },
    GNO: { address: '0x22441d81416430A54336aB28765abd31a792Ad37', decimals: 8 },
    USDC: { address: '0x26C31ac71010aF62E6B486D1132E266D6298857D', decimals: 8 },
    LINK: { address: '0xed322A5ac55BAE091190dFf9066760b86751947B', decimals: 8 },
  },
  // Sepolia (testnet)
  11155111: {
    ETH: { address: '0x694AA1769357215DE4FAC081bf1f309aDC325306', decimals: 8 },
    WETH: { address: '0x694AA1769357215DE4FAC081bf1f309aDC325306', decimals: 8 },
    BTC: { address: '0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43', decimals: 8 },
    USDC: { address: '0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E', decimals: 8 },
    LINK: { address: '0xc59E3633BAAC79493d908e63626716e204A45EdF', decimals: 8 },
    DAI: { address: '0x14866185B1962B63C3Ea9E03Bc1da838bab34C19', decimals: 8 },
  },
}

// Cache state
let oracleCache: Record<number, Record<string, ChainlinkFeed>> = {}
let cacheTimestamp = 0

async function fetchRddFeeds(url: string): Promise<Record<string, ChainlinkFeed>> {
  const response = await fetch(url)
  const entries: RddEntry[] = await response.json()
  const feeds: Record<string, ChainlinkFeed> = {}

  for (const entry of entries) {
    if (entry.docs?.quoteAsset !== 'USD') continue
    if (entry.docs?.assetClass !== 'Crypto') continue
    if (entry.docs?.productType !== 'Price') continue
    if (entry.docs?.hidden) continue
    if (entry.proxyAddress === ZERO_ADDRESS) continue
    if (entry.name.includes('SVR')) continue

    const symbol = entry.docs.baseAsset?.toUpperCase()
    if (!symbol) continue

    // First match wins — verified feeds are listed first in RDD
    if (feeds[symbol]) continue

    feeds[symbol] = { address: entry.proxyAddress, decimals: entry.decimals }

    const aliases = SYMBOL_ALIASES[symbol]
    if (aliases) {
      for (const alias of aliases) {
        if (!feeds[alias]) feeds[alias] = feeds[symbol]
      }
    }
  }

  return feeds
}

export async function refreshOracleCache(): Promise<void> {
  const results = await Promise.all(
    Object.entries(RDD_URLS).map(async ([chainIdStr, url]) => {
      const chainId = Number(chainIdStr)
      const feeds = await fetchRddFeeds(url)
      return [chainId, feeds] as const
    })
  )

  const newCache: Record<number, Record<string, ChainlinkFeed>> = {}
  for (const [chainId, feeds] of results) {
    newCache[chainId] = feeds
  }

  // Preserve Sepolia from fallback (no RDD for testnet)
  if (FALLBACK_ORACLES[11155111]) {
    newCache[11155111] = FALLBACK_ORACLES[11155111]
  }

  oracleCache = newCache
  cacheTimestamp = Date.now()
  const totalFeeds = Object.values(newCache).reduce((sum, feeds) => sum + Object.keys(feeds).length, 0)
  console.log(`[Oracle Cache] Loaded ${totalFeeds} feeds across ${Object.keys(newCache).length} chains`)
}

async function ensureCache(): Promise<void> {
  if (Date.now() - cacheTimestamp > CACHE_TTL_MS) {
    await refreshOracleCache()
  }
}

export function getChainlinkOracle(chainId: number, rawSymbol: string): ChainlinkFeed | undefined {
  const symbol = rawSymbol.toUpperCase()

  // Try dynamic cache first, fall back to hardcoded
  const dynamicResult = oracleCache[chainId]?.[symbol]
  if (dynamicResult) return dynamicResult

  return FALLBACK_ORACLES[chainId]?.[symbol]
}

export async function getChainlinkOracleWithRefresh(
  chainId: number,
  rawSymbol: string
): Promise<ChainlinkFeed | undefined> {
  await ensureCache()
  return getChainlinkOracle(chainId, rawSymbol)
}

export function getSupportedOracleTokens(chainId: number): string[] {
  const cacheTokens = Object.keys(oracleCache[chainId] ?? {})
  const fallbackTokens = Object.keys(FALLBACK_ORACLES[chainId] ?? {})
  return [...new Set([...cacheTokens, ...fallbackTokens])]
}
