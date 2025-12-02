import { useState } from 'react'

export type UseCopyToClipboardProps = {
  timeout?: number
}

export function useCopyToClipboard({ timeout = 2000 }: UseCopyToClipboardProps = {}) {
  const [isCopied, setIsCopied] = useState(false)
  const [isCopying, setIsCopying] = useState(false)

  const copyToClipboard = (value: string) => {
    if (typeof window === 'undefined' || !navigator.clipboard?.writeText) {
      return
    }

    if (!value) {
      return
    }

    if (isCopying) return
    setIsCopying(true)

    void navigator.clipboard.writeText(value)

    setIsCopied(true)

    setTimeout(() => {
      setIsCopying(false)
      setIsCopied(false)
    }, timeout)
  }

  return { isCopied, isCopying, copyToClipboard }
}
