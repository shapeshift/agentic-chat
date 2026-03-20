---
id: sa-ocsg
status: closed
type: feature
priority: 2
assignee: Jibles
created: 2026-03-15T23:42:03Z
---
# Portfolio loading UX: skeleton/progress states & cache persistence

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

