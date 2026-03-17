---
id: sa-ocsg
status: open
deps: []
links: []
created: 2026-03-15T23:42:03Z
type: feature
priority: 2
assignee: Jibles
---
# Portfolio loading UX: skeleton/progress states & cache persistence

## Problem

The wallet panel portfolio has two UX issues:

### 1. Initial load feels broken for large wallets
When opening the portfolio drawer, `PortfolioAssetList` and `PortfolioHeader` show static skeleton loaders via react-query's `isLoading` flag. For wallets with many chains, the single `/api/portfolio` POST can take 10-20+ seconds. There's no progress indicator — just frozen skeletons with no feedback that anything is happening.

### 2. Portfolio data disappears on drawer reopen
After closing the drawer and switching tabs/navigating, reopening shows an empty loading state again. Two causes:
- **Cache GC (>5 min)**: `gcTime: 5 * 60 * 1000` means data is garbage collected after 5 minutes of the component being unmounted, forcing a full refetch
- **Query key instability**: The query key is `['portfolio', primaryWallet?.address]`. If Dynamic SDK re-initializes on tab switch (common), the `primaryWallet` reference may change, producing a new query key with no cached data — triggering a fresh load even within the gcTime window

## Key Files

- `apps/agentic-chat/src/hooks/usePortfolioQuery.ts` — react-query config (staleTime: 10s, gcTime: 5min)
- `apps/agentic-chat/src/services/portfolioService.ts` — single POST to `/api/portfolio`
- `apps/agentic-chat/src/components/Portfolio/PortfolioAssetList.tsx` — skeleton loader, `isLoading` check
- `apps/agentic-chat/src/components/Portfolio/PortfolioHeader.tsx` — skeleton loader, `isLoading` check
- `apps/agentic-chat/src/components/Portfolio/PortfolioDrawer.tsx` — drawer shell, error state

## Suggested Approach

### Loading UX
- Add a subtle animated indicator (pulsing dot, spinner, or "Loading X chains..." text) alongside skeletons so users know the fetch is active
- Consider showing `isFetching` state for background refetches (currently only `isLoading` is checked, so stale refetches show old data silently)

### Cache Persistence
- Increase `gcTime` significantly (e.g., 30 min or Infinity) so closing/reopening the drawer doesn't lose data
- Ensure query key stability — derive the key from the address string, not the wallet object reference (already done, but verify Dynamic SDK doesn't cause address to flicker to undefined on tab switch)
- Consider using `placeholderData: keepPreviousData` so transitioning between query keys doesn't flash empty state

### Stretch
- Stream portfolio results per-chain so partial data renders progressively (would require server-side changes)

## Acceptance Criteria

- [ ] Opening portfolio drawer shows a clear loading indicator (not just static skeletons) that communicates active loading
- [ ] Closing and reopening the drawer within a reasonable window (~30 min) shows cached data immediately without a loading flash
- [ ] Switching browser tabs and returning does not cause the portfolio to reload from scratch
- [ ] Background refetches (stale data) show existing data with a subtle refresh indicator rather than skeletons
- [ ] Error states still work correctly (retry button shown on fetch failure)
