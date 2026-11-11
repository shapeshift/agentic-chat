import type { InitiateSwapOutput } from '@shapeshiftoss/agentic-server'

export async function refreshSwapQuote(quote: InitiateSwapOutput): Promise<InitiateSwapOutput> {
  const swap = quote.swapData
  const response = await fetch(`${import.meta.env.VITE_AGENTIC_SERVER_BASE_URL}/api/swap/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      sellAssetId: swap.sellAsset.assetId,
      buyAssetId: swap.buyAsset.assetId,
      sellAmount: swap.sellAmountCryptoPrecision,
      sellAccount: swap.sellAccount,
      buyAccount: swap.buyAccount,
    }),
  })
  if (!response.ok) {
    // Proxies and older backends can return non-JSON errors (e.g. a 404 before the route is deployed).
    const result = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(result.error || 'Unable to refresh swap quote. Please try again.')
  }
  return response.json() as Promise<InitiateSwapOutput>
}
