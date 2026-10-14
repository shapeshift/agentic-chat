import { AsyncLocalStorage } from 'node:async_hooks'

const signals = new AsyncLocalStorage<AbortSignal>()

export const getRequestSignal = () => signals.getStore()
export const withRequestSignal = <T>(signal: AbortSignal, run: () => T): T => signals.run(signal, run)
