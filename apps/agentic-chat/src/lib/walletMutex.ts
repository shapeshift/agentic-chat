let pending = Promise.resolve()

export function withWalletLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = pending.then(fn, fn)
  pending = next.then(
    () => {},
    () => {}
  )
  return next
}
