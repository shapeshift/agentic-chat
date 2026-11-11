import type { InitiateSwapOutput } from '@shapeshiftoss/agentic-server'

import { bn } from '@/lib/bignumber'

export type SwapQuote = InitiateSwapOutput

// Leave time for wallet interaction; this cannot extend a provider's deadline.
export const QUOTE_SIGNING_BUFFER_MS = 10_000

export function isQuoteFresh(quote: SwapQuote, now = Date.now()): boolean {
  return Number.isFinite(quote.expiresAt) && quote.expiresAt! > now + QUOTE_SIGNING_BUFFER_MS
}

export function assertQuoteFresh(quote: SwapQuote): void {
  if (!isQuoteFresh(quote)) throw new Error('Swap quote expired. Please request a new swap before signing.')
}

// Quotes move on every refresh; only ask again when the user is meaningfully worse off.
// Swap quotes carry no slippage setting, so the output tolerance is a fixed 0.5%.
export const BUY_AMOUNT_DROP_TOLERANCE = 0.005
export const NETWORK_FEE_RISE_TOLERANCE = 0.25
// Fee rises at or below this many USD never prompt, so cent-level L2 gas noise is ignored.
export const NETWORK_FEE_RISE_USD_FLOOR = 0.5

// Missing or malformed values count as worse, so an unreadable quote still asks.
function decimal(value: string | undefined) {
  const parsed = bn(value ?? NaN)
  return parsed.isFinite() ? parsed : undefined
}

function buyAmountDropped(agreed: SwapQuote, next: SwapQuote): boolean {
  const before = decimal(agreed.swapData.buyAmountCryptoPrecision)
  const after = decimal(next.swapData.buyAmountCryptoPrecision)
  if (!after) return true
  if (!before) return false
  return after.lt(before.times(1 - BUY_AMOUNT_DROP_TOLERANCE))
}

function networkFeeRose(agreed: SwapQuote, next: SwapQuote): boolean {
  const { exchange: a } = agreed.summary
  const { exchange: b } = next.summary
  if (a.networkFeeCrypto === undefined && b.networkFeeCrypto === undefined) return false
  const before = decimal(a.networkFeeCrypto) ?? bn(0)
  const after = decimal(b.networkFeeCrypto)
  if (!after) return true
  if (!after.gt(before.times(1 + NETWORK_FEE_RISE_TOLERANCE))) return false
  const beforeUsd = decimal(a.networkFeeUsd) ?? (a.networkFeeCrypto === undefined ? bn(0) : undefined)
  const afterUsd = decimal(b.networkFeeUsd)
  // Without USD values on both sides, the relative rise alone decides.
  if (!beforeUsd || !afterUsd) return true
  return afterUsd.minus(beforeUsd).gt(NETWORK_FEE_RISE_USD_FLOOR)
}

export function termsChanged(agreed: SwapQuote, next: SwapQuote): boolean {
  return (
    agreed.swapData.approvalTarget !== next.swapData.approvalTarget ||
    agreed.summary.exchange.provider !== next.summary.exchange.provider ||
    buyAmountDropped(agreed, next) ||
    networkFeeRose(agreed, next)
  )
}

function sameAccount(chainId: string, a: string, b: string): boolean {
  return chainId.startsWith('eip155:') ? a.toLowerCase() === b.toLowerCase() : a === b
}

// Pass the live wallet: refs captured by a tool card stop updating once it unmounts.
export function assertSwapWallet(quote: SwapQuote, wallet: { evmAddress?: string; solanaAddress?: string }): void {
  for (const [asset, account] of [
    [quote.swapData.sellAsset, quote.swapData.sellAccount],
    [quote.swapData.buyAsset, quote.swapData.buyAccount],
  ] as const) {
    const address = asset.chainId.startsWith('eip155:') ? wallet.evmAddress : wallet.solanaAddress
    if (!address || !sameAccount(asset.chainId, address, account))
      throw new Error('Wallet changed or disconnected. Please re-initiate the swap.')
  }
}

export function assertSameSwap(original: SwapQuote, next: SwapQuote): void {
  const a = original.swapData
  const b = next.swapData
  if (
    a.sellAsset.assetId !== b.sellAsset.assetId ||
    a.buyAsset.assetId !== b.buyAsset.assetId ||
    a.sellAmountCryptoPrecision !== b.sellAmountCryptoPrecision ||
    a.sellAsset.chainId !== b.sellAsset.chainId ||
    a.buyAsset.chainId !== b.buyAsset.chainId ||
    a.sellAsset.precision !== b.sellAsset.precision ||
    !sameAccount(a.sellAsset.chainId, a.sellAccount, b.sellAccount) ||
    !sameAccount(a.buyAsset.chainId, a.buyAccount, b.buyAccount) ||
    !sameAccount(b.sellAsset.chainId, next.swapTx.from, b.sellAccount) ||
    next.swapTx.chainId !== b.sellAsset.chainId
  )
    throw new Error('Refreshed quote changed the requested swap. Please start again.')
}

export async function prepareFreshSwap(
  original: SwapQuote,
  actions: {
    refresh: (quote: SwapQuote) => Promise<SwapQuote>
    approve: (quote: SwapQuote) => Promise<boolean>
    confirm: (quote: SwapQuote) => Promise<boolean>
    show: (quote: SwapQuote) => void
    assertWallet: () => void
  }
): Promise<SwapQuote> {
  // Compare against terms the user saw and agreed to, so small drifts cannot add up unseen.
  let agreed = original
  // Bound repeated expiry or spender changes; never fall back to stale calldata.
  for (let attempt = 0; attempt < 5; attempt++) {
    actions.assertWallet()
    const quote = await actions.refresh(original)
    assertSameSwap(original, quote)
    actions.assertWallet()
    assertQuoteFresh(quote)
    actions.show(quote)
    if (termsChanged(agreed, quote)) {
      if (!(await actions.confirm(quote))) throw new Error('Swap cancelled before signing.')
      agreed = quote
    }
    actions.assertWallet()
    if (!isQuoteFresh(quote)) continue
    // Always check the refreshed spender, even when the original quote needed no approval.
    const approved = await actions.approve(quote)
    actions.assertWallet()
    // Any approval can age the quote. Refresh again after it confirms.
    if (approved || !isQuoteFresh(quote)) continue
    return quote
  }
  throw new Error('Unable to obtain a fresh swap quote. Please try again.')
}
