import { useCallback, useMemo, useSyncExternalStore } from 'react'

export function useMediaQuery(query: string) {
  const media = useMemo(() => window.matchMedia(query), [query])
  const subscribe = useCallback(
    (onChange: () => void) => {
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    [media]
  )

  return useSyncExternalStore(subscribe, () => media.matches)
}
