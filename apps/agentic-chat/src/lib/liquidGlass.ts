const MAX_SAFE_DEVICE_MEMORY_GB = 4
const MAX_SAFE_HARDWARE_CONCURRENCY = 4

interface NavigatorWithDeviceMemory extends Navigator {
  deviceMemory?: number
}

const isPerfSensitiveDevice = (navigatorLike: Navigator) => {
  const withDeviceMemory = navigatorLike as NavigatorWithDeviceMemory
  const lowMemory =
    typeof withDeviceMemory.deviceMemory === 'number' && withDeviceMemory.deviceMemory <= MAX_SAFE_DEVICE_MEMORY_GB
  const lowCpu =
    typeof navigatorLike.hardwareConcurrency === 'number' &&
    navigatorLike.hardwareConcurrency > 0 &&
    navigatorLike.hardwareConcurrency <= MAX_SAFE_HARDWARE_CONCURRENCY

  return lowMemory || lowCpu
}

export const shouldEnableLiquidGlass = (navigatorLike: Navigator, matchMedia: (query: string) => MediaQueryList) => {
  const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
  const isMobileViewport = matchMedia('(max-width: 768px)').matches
  const isCoarsePointer = matchMedia('(pointer: coarse)').matches

  if (prefersReducedMotion || isMobileViewport || isCoarsePointer) return false
  if (isPerfSensitiveDevice(navigatorLike)) return false

  return true
}

export const applyLiquidGlassMode = (doc: Document = document) => {
  const enabled = shouldEnableLiquidGlass(window.navigator, window.matchMedia)
  doc.documentElement.classList.toggle('spike-liquid-glass-enabled', enabled)
  doc.documentElement.classList.toggle('spike-liquid-glass-disabled', !enabled)
}
