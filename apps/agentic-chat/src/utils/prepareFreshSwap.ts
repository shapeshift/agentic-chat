import type { InitiateSwapOutput } from '@shapeshiftoss/agentic-server'

export type SwapQuote = InitiateSwapOutput

// Leave time for wallet interaction; this cannot extend a provider's deadline.
export const QUOTE_SIGNING_BUFFER_MS = 10_000

export function isQuoteFresh(quote: SwapQuote, now = Date.now()): boolean {
  return Number.isFinite(quote.expiresAt) && quote.expiresAt! > now + QUOTE_SIGNING_BUFFER_MS
}

export function assertQuoteFresh(quote: SwapQuote): void {
  if (!isQuoteFresh(quote)) throw new Error('Swap quote expired. Please request a new swap before signing.')
}

function termsChanged(previous: SwapQuote, next: SwapQuote): boolean {
  return (
    previous.swapData.buyAmountCryptoPrecision !== next.swapData.buyAmountCryptoPrecision ||
    previous.swapData.approvalTarget !== next.swapData.approvalTarget ||
    previous.summary.exchange.provider !== next.summary.exchange.provider ||
    previous.summary.exchange.networkFeeCrypto !== next.summary.exchange.networkFeeCrypto
  )
}

function sameAccount(chainId: string, a: string, b: string): boolean {
  return chainId.startsWith('eip155:') ? a.toLowerCase() === b.toLowerCase() : a === b
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
  let previous = original
  // Bound repeated expiry or spender changes; never fall back to stale calldata.
  for (let attempt = 0; attempt < 5; attempt++) {
    actions.assertWallet()
    const quote = await actions.refresh(original)
    assertSameSwap(original, quote)
    actions.assertWallet()
    assertQuoteFresh(quote)
    actions.show(quote)
    if (termsChanged(previous, quote)) {
      if (!(await actions.confirm(quote))) throw new Error('Swap cancelled before signing.')
    }
    previous = quote
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
