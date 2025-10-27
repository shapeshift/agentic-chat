import { useState, useEffect } from 'react'

type SetValueArg<T> = T | ((val: T) => T)

export function useLocalStorage<T>(key: string | null, initialValue: T): [T, (val: SetValueArg<T>) => void] {
  const readValue = (storageKey: string | null): T => {
    if (typeof window === 'undefined' || !storageKey) {
      return initialValue
    }

    try {
      const item = window.localStorage.getItem(storageKey)
      if (item === null) {
        return initialValue
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return JSON.parse(item)
      } catch {
        return item as unknown as T
      }
    } catch {
      return initialValue
    }
  }

  const [storedValue, setStoredValue] = useState<T>(() => readValue(key))

  useEffect(() => {
    setStoredValue(readValue(key))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const setValue = (value: SetValueArg<T>): void => {
    if (!key) return

    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore))
      }
    } catch {
      // Silently fail - localStorage might be full or unavailable
    }
  }

  return [storedValue, setValue]
}
