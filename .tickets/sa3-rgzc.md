---
id: sa3-rgzc
status: closed
deps: []
links: []
created: 2026-03-09T00:43:44Z
type: feature
priority: 2
assignee: Jibles
---
# Retry mechanisms for failed agentic transactions

# Retry Mechanisms for Failed Agentic Transactions

Linear: SS-5512

## Architecture

A single `withRetry<T>()` utility that accepts an async function and options:
- Exponential backoff: 1s → 2s → 4s
- 3 max retries
- Error classification via `isRetryableError()`
- Console logging on each retry: "Retrying... (2/3)"
- Returns result on success or throws final error after exhausting retries

A shared `isRetryableError(error): boolean` function extending the existing `walletErrors.ts`.

### Files
- `apps/agentic-chat/src/utils/retry.ts` — `withRetry()` utility
- `apps/agentic-chat/src/utils/walletErrors.ts` — add `isRetryableError()` alongside existing `isUserCancellation()`
- Backend equivalent in the server for quote fetching (same pattern)

## Integration Points

### Safe to retry (idempotent or read-only)
- Backend quote/API fetches (0x, CowSwap, Jupiter, etc.) — read-only
- Gas estimation — read-only
- `waitForTransactionReceipt` — read-only polling
- CoW order submission — idempotent by order hash

### NOT retried (double-send risk or user interaction)
- `sendEvmTransaction` / `wallet.sendTransaction()` — if tx was broadcast but we got a network error back, retrying could double-send
- `sendSolanaTransaction` — same risk
- Wallet signing / `signTypedDataWithWallet()` — user interaction
- `wallet.switchNetwork()` — user interaction

### Frontend executor integration
- `swapExecutor.ts`: wrap `waitForTransactionReceipt` and gas estimation calls
- `sendExecutor.ts`: wrap receipt waiting and gas estimation
- `limitOrderExecution.tsx`: wrap `submitSignedOrder()` (CoW API submission)
- `chains/evm/transaction.ts`: do NOT wrap `sendEvmTransaction` — double-send risk

### Backend server integration
- Wrap all external API calls for quotes/tx data generation

## Error Classification

Added to existing `walletErrors.ts` as `isRetryableError(error): boolean`.

### Retryable patterns (auto-retry with backoff)
- Network: ETIMEDOUT, ECONNRESET, ECONNREFUSED, fetch failed, network error
- RPC: 502, 503, 429, rate limit
- Gas: gas estimation failed (transient, not revert-based)
- Generic: timeout, EHOSTUNREACH

### Non-retryable (fail immediately)
- User rejection: reuse existing `isUserCancellation()`
- Insufficient funds: insufficient funds, exceeds balance
- Contract revert: execution reverted, revert
- Bad request: invalid, bad request, HTTP 400/401/403/404

Function checks non-retryable first (fail fast), then retryable patterns. Unknown errors default to non-retryable.

## Testing Approach
- Unit tests for `withRetry()`: backoff timing, max retries, error propagation after exhaustion, immediate failure for non-retryable errors
- Unit tests for `isRetryableError()`: each pattern — network errors, RPC codes, user rejections, insufficient funds, unknown errors defaulting to non-retryable
- Integration: manual testing against actual swap/send/limit order flows
- All tests use `bun:test`

## Approved Approach

Approach 1: Retry wrapper utility. A single `withRetry()` function wraps any async call at the call site. Keeps retry logic in one place, gives explicit control over which calls get retried, and is testable in isolation. ~50 lines of core utility code plus one-line changes at each integration point.

Key safety decision: `sendTransaction` calls are excluded from retry entirely to eliminate any double-spend risk. Only idempotent/read-only operations are retried.

## Notes

**2026-03-09T00:46:53Z**

# Retry Mechanisms Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use /run tk:sa3-rgzc to implement this plan task-by-task via subagent-driven-development.

**Goal:** Add a `withRetry()` utility with exponential backoff that wraps retryable async calls (quotes, receipts, order submission) while excluding dangerous-to-retry operations (transaction sends, wallet signing).

**Architecture:** A single generic `withRetry<T>()` wraps any async function with exponential backoff (1s→2s→4s, 3 max retries). Error classification via `isRetryableError()` in `walletErrors.ts` determines whether to retry or fail fast. Integration is one-line wraps at each call site — no structural changes to existing code.

**Tech Stack:** TypeScript, bun:test, existing walletErrors.ts patterns

---

### Task 1: Add `isRetryableError()` to walletErrors.ts

**Files:**
- Modify: `apps/agentic-chat/src/utils/walletErrors.ts`
- Create: `apps/agentic-chat/src/utils/__tests__/walletErrors.test.ts`

**Step 1: Write the failing tests**

Create `apps/agentic-chat/src/utils/__tests__/walletErrors.test.ts`:

```typescript
import { describe, expect, it } from 'bun:test'

import { isRetryableError } from '../walletErrors'

describe('isRetryableError', () => {
  describe('retryable errors', () => {
    it.each([
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED',
      'fetch failed',
      'network error',
      'EHOSTUNREACH',
      'timeout',
    ])('returns true for network error: %s', (msg) => {
      expect(isRetryableError(new Error(msg))).toBe(true)
    })

    it.each([502, 503, 429])('returns true for HTTP status %d', (status) => {
      expect(isRetryableError(new Error(`Request failed with status ${status}`))).toBe(true)
    })

    it('returns true for rate limit error', () => {
      expect(isRetryableError(new Error('rate limit exceeded'))).toBe(true)
    })

    it('returns true for gas estimation failure', () => {
      expect(isRetryableError(new Error('gas estimation failed'))).toBe(true)
    })
  })

  describe('non-retryable errors', () => {
    it('returns false for user rejection (defers to isUserCancellation)', () => {
      const err = new Error('user rejected the request')
      expect(isRetryableError(err)).toBe(false)
    })

    it.each([
      'insufficient funds for gas',
      'exceeds balance',
    ])('returns false for balance error: %s', (msg) => {
      expect(isRetryableError(new Error(msg))).toBe(false)
    })

    it.each([
      'execution reverted',
      'transaction revert',
    ])('returns false for contract revert: %s', (msg) => {
      expect(isRetryableError(new Error(msg))).toBe(false)
    })

    it.each([
      'invalid parameter',
      'bad request',
    ])('returns false for bad request: %s', (msg) => {
      expect(isRetryableError(new Error(msg))).toBe(false)
    })

    it('returns false for unknown errors', () => {
      expect(isRetryableError(new Error('something weird happened'))).toBe(false)
    })

    it('returns false for non-Error values', () => {
      expect(isRetryableError('string error')).toBe(false)
      expect(isRetryableError(42)).toBe(false)
      expect(isRetryableError(null)).toBe(false)
    })
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd apps/agentic-chat && bun test src/utils/__tests__/walletErrors.test.ts`
Expected: FAIL — `isRetryableError` is not exported

**Step 3: Implement `isRetryableError`**

Add to the bottom of `apps/agentic-chat/src/utils/walletErrors.ts`:

```typescript
const RETRYABLE_PATTERNS = [
  'etimedout',
  'econnreset',
  'econnrefused',
  'ehostunreach',
  'fetch failed',
  'network error',
  'timeout',
  'rate limit',
  'gas estimation failed',
  'status 429',
  'status 502',
  'status 503',
]

const NON_RETRYABLE_PATTERNS = [
  'insufficient funds',
  'exceeds balance',
  'execution reverted',
  'revert',
  'invalid',
  'bad request',
  'status 400',
  'status 401',
  'status 403',
  'status 404',
]

export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  if (isUserCancellation(error)) return false

  const message = error.message.toLowerCase()

  if (NON_RETRYABLE_PATTERNS.some(p => message.includes(p))) return false
  if (RETRYABLE_PATTERNS.some(p => message.includes(p))) return true

  return false
}
```

**Step 4: Run tests to verify they pass**

Run: `cd apps/agentic-chat && bun test src/utils/__tests__/walletErrors.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add apps/agentic-chat/src/utils/walletErrors.ts apps/agentic-chat/src/utils/__tests__/walletErrors.test.ts
git commit -m "feat: add isRetryableError() to walletErrors for retry classification"
```

---

### Task 2: Create `withRetry()` utility

**Files:**
- Create: `apps/agentic-chat/src/utils/retry.ts`
- Create: `apps/agentic-chat/src/utils/__tests__/retry.test.ts`

**Step 1: Write the failing tests**

Create `apps/agentic-chat/src/utils/__tests__/retry.test.ts`:

```typescript
import { describe, expect, it, mock, beforeEach } from 'bun:test'

import { withRetry } from '../retry'

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = mock(() => Promise.resolve('ok'))
    const result = await withRetry(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on retryable error and succeeds', async () => {
    let calls = 0
    const fn = mock(() => {
      calls++
      if (calls < 3) return Promise.reject(new Error('ECONNRESET'))
      return Promise.resolve('recovered')
    })

    const result = await withRetry(fn)
    expect(result).toBe('recovered')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('throws after exhausting retries', async () => {
    const fn = mock(() => Promise.reject(new Error('ECONNRESET')))
    await expect(withRetry(fn, { maxRetries: 2, initialDelayMs: 1 })).rejects.toThrow('ECONNRESET')
    expect(fn).toHaveBeenCalledTimes(3) // 1 initial + 2 retries
  })

  it('does not retry non-retryable errors', async () => {
    const fn = mock(() => Promise.reject(new Error('insufficient funds')))
    await expect(withRetry(fn, { initialDelayMs: 1 })).rejects.toThrow('insufficient funds')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('does not retry user cancellations', async () => {
    const err = new Error('user rejected the request')
    const fn = mock(() => Promise.reject(err))
    await expect(withRetry(fn, { initialDelayMs: 1 })).rejects.toThrow('user rejected')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('respects custom maxRetries', async () => {
    const fn = mock(() => Promise.reject(new Error('ETIMEDOUT')))
    await expect(withRetry(fn, { maxRetries: 1, initialDelayMs: 1 })).rejects.toThrow('ETIMEDOUT')
    expect(fn).toHaveBeenCalledTimes(2) // 1 initial + 1 retry
  })

  it('applies exponential backoff timing', async () => {
    const timestamps: number[] = []
    const fn = mock(() => {
      timestamps.push(Date.now())
      return Promise.reject(new Error('ECONNRESET'))
    })

    await withRetry(fn, { maxRetries: 2, initialDelayMs: 50 }).catch(() => {})

    // First retry delay ~50ms, second ~100ms
    const delay1 = timestamps[1] - timestamps[0]
    const delay2 = timestamps[2] - timestamps[1]
    expect(delay1).toBeGreaterThanOrEqual(40)
    expect(delay1).toBeLessThan(150)
    expect(delay2).toBeGreaterThanOrEqual(80)
    expect(delay2).toBeLessThan(300)
  })

  it('logs retry attempts', async () => {
    const logs: string[] = []
    const originalLog = console.log
    console.log = (...args: unknown[]) => logs.push(args.join(' '))

    const fn = mock(() => Promise.reject(new Error('ECONNRESET')))
    await withRetry(fn, { maxRetries: 2, initialDelayMs: 1 }).catch(() => {})

    console.log = originalLog

    expect(logs.some(l => l.includes('Retrying'))).toBe(true)
    expect(logs.some(l => l.includes('1/2'))).toBe(true)
    expect(logs.some(l => l.includes('2/2'))).toBe(true)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd apps/agentic-chat && bun test src/utils/__tests__/retry.test.ts`
Expected: FAIL — `withRetry` is not exported / module not found

**Step 3: Implement `withRetry`**

Create `apps/agentic-chat/src/utils/retry.ts`:

```typescript
import { isRetryableError } from './walletErrors'

interface RetryOptions {
  maxRetries?: number
  initialDelayMs?: number
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3
  const initialDelayMs = options?.initialDelayMs ?? 1000

  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (!isRetryableError(error) || attempt === maxRetries) throw lastError

      const delayMs = initialDelayMs * Math.pow(2, attempt)
      console.log(`Retrying... (${attempt + 1}/${maxRetries})`)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  throw lastError
}
```

**Step 4: Run tests to verify they pass**

Run: `cd apps/agentic-chat && bun test src/utils/__tests__/retry.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add apps/agentic-chat/src/utils/retry.ts apps/agentic-chat/src/utils/__tests__/retry.test.ts
git commit -m "feat: add withRetry() utility with exponential backoff"
```

---

### Task 3: Integrate retry into `waitForConfirmedReceipt`

**Files:**
- Modify: `apps/agentic-chat/src/utils/waitForConfirmedReceipt.ts`

**Step 1: Wrap the receipt call with `withRetry`**

Current code in `waitForConfirmedReceipt.ts` (line 8):
```typescript
const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations, timeout: 300_000 })
```

Replace with:
```typescript
const receipt = await withRetry(
  () => publicClient.waitForTransactionReceipt({ hash, confirmations, timeout: 300_000 })
)
```

Add the import at the top:
```typescript
import { withRetry } from './retry'
```

**Step 2: Verify existing tests still pass**

Run: `cd apps/agentic-chat && bun test`
Expected: All existing tests PASS

**Step 3: Commit**

```bash
git add apps/agentic-chat/src/utils/waitForConfirmedReceipt.ts
git commit -m "feat: wrap waitForConfirmedReceipt with retry for transient failures"
```

---

### Task 4: Integrate retry into limit order submission

**Files:**
- Modify: `apps/agentic-chat/src/hooks/useLimitOrderExecution.tsx`

The `submitSignedOrder` function (line 133) makes a fetch POST to CoW API — this is idempotent by order hash and safe to retry.

**Step 1: Wrap the fetch call inside `submitSignedOrder`**

In `apps/agentic-chat/src/hooks/useLimitOrderExecution.tsx`, line 133, replace:
```typescript
  const response = await fetch(`${apiUrl}/api/v1/orders`, {
```

Wrap the entire fetch + response handling block (lines 133-151) with `withRetry`:

```typescript
  return withRetry(async () => {
    const response = await fetch(`${apiUrl}/api/v1/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to submit order to CoW: ${errorText}`)
    }

    const orderId = await response.text()
    const cleanOrderId = orderId.replace(/"/g, '')
    if (!cleanOrderId || cleanOrderId.length < 10) {
      throw new Error(`Invalid order ID received from CoW: ${cleanOrderId}`)
    }
    return cleanOrderId
  })
```

Add import at top of file:
```typescript
import { withRetry } from '@/utils/retry'
```

**Step 2: Verify existing tests still pass**

Run: `cd apps/agentic-chat && bun test`
Expected: All existing tests PASS

**Step 3: Commit**

```bash
git add apps/agentic-chat/src/hooks/useLimitOrderExecution.tsx
git commit -m "feat: add retry to CoW order submission in limit order execution"
```

---

### Task 5: Add retry to backend server API calls

**Files:**
- Create: `apps/agentic-server/src/utils/retry.ts`
- Modify: `apps/agentic-server/src/utils/getBebopRate/getBebopRate.ts`
- Modify: `apps/agentic-server/src/utils/getRelayRate/getRelayRate.ts`

The server needs its own copy of `withRetry` since it's a separate package. The server version uses a simpler retry check (axios errors with retryable status codes + network errors).

**Step 1: Create server-side `withRetry`**

Create `apps/agentic-server/src/utils/retry.ts`:

```typescript
import axios from 'axios'

const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504])

const RETRYABLE_ERROR_CODES = new Set([
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'ERR_NETWORK',
])

function isRetryableError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    if (error.response && RETRYABLE_STATUS_CODES.has(error.response.status)) return true
    if (error.code && RETRYABLE_ERROR_CODES.has(error.code)) return true
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    return msg.includes('fetch failed') || msg.includes('network error') || msg.includes('timeout')
  }

  return false
}

interface RetryOptions {
  maxRetries?: number
  initialDelayMs?: number
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3
  const initialDelayMs = options?.initialDelayMs ?? 1000

  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (!isRetryableError(error) || attempt === maxRetries) throw lastError

      const delayMs = initialDelayMs * Math.pow(2, attempt)
      console.log(`[retry] Attempt ${attempt + 1}/${maxRetries} after ${delayMs}ms`)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  throw lastError
}
```

**Step 2: Wrap Bebop rate fetching**

In `apps/agentic-server/src/utils/getBebopRate/getBebopRate.ts`, wrap the axios call (line 69) inside the existing try block. Replace the entire try/catch (lines 68-113):

```typescript
  return withRetry(async () => {
    try {
      const { data } = await axios.get<BebopResponse>(`https://api.bebop.xyz/router/${bebopNetwork}/v1/quote`, {
        headers: { 'source-auth': BEBOP_API_KEY },
        params: requestParams,
      })

      if (!data.routes?.[0]?.quote) throw new Error('No routes found in Bebop response')

      const quote = data.routes[0].quote
      const buyToken = quote.buyTokens[buyTokenAddress]
      if (!buyToken) throw new Error('Buy token not found in quote')

      const buyAmountCryptoBaseUnit = buyToken.amount.toString()
      const buyAmountCryptoPrecision = fromBaseUnit(buyAmountCryptoBaseUnit, buyToken.decimals)

      return {
        approvalTarget: quote.approvalTarget,
        buyAsset,
        buyAmountCryptoPrecision,
        sellAsset,
        sellAmountCryptoPrecision,
        source: 'bebop',
        unsignedTx: {
          chainId: sellAsset.chainId,
          data: quote.tx.data,
          from: quote.tx.from,
          to: quote.tx.to,
          value: quote.tx.value,
          ...(quote.tx.gas && { gasLimit: quote.tx.gas }),
        },
        networkFeeCryptoPrecision: quote.gasFee.native,
        networkFeeUsd: quote.gasFee.usd.toString(),
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const data = error.response?.data as { error?: { message?: string }; message?: string } | undefined
        const apiMessage = data?.error?.message || data?.message || error.message
        console.error('[getBebopRate] API request failed:', error.response?.status, data || error.message)
        throw new Error(`Bebop: ${apiMessage}`)
      }
      console.error('[getBebopRate] Unexpected error:', error)
      throw new Error(`Bebop: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  })
```

Add import at top:
```typescript
import { withRetry } from '../retry'
```

**Step 3: Wrap Relay rate fetching**

Apply the same pattern to `apps/agentic-server/src/utils/getRelayRate/getRelayRate.ts` — wrap the axios call with `withRetry`. Add `import { withRetry } from '../retry'` and wrap the try/catch block the same way as Bebop.

**Step 4: Verify the server builds**

Run: `cd apps/agentic-server && bun run build` (or `bunx tsc --noEmit`)
Expected: No type errors

**Step 5: Commit**

```bash
git add apps/agentic-server/src/utils/retry.ts apps/agentic-server/src/utils/getBebopRate/getBebopRate.ts apps/agentic-server/src/utils/getRelayRate/getRelayRate.ts
git commit -m "feat: add retry utility to server and wrap quote API calls"
```

---

### Task 6: Final verification

**Step 1: Run all frontend tests**

Run: `cd apps/agentic-chat && bun test`
Expected: All tests PASS

**Step 2: Run type checks across both apps**

Run: `cd apps/agentic-chat && bunx tsc --noEmit && cd ../agentic-server && bunx tsc --noEmit`
Expected: No type errors

**Step 3: Verify nothing unsafe is retried**

Manually verify these files do NOT use `withRetry`:
- `apps/agentic-chat/src/utils/chains/evm/transaction.ts` — `sendEvmTransaction` must NOT be wrapped
- `apps/agentic-chat/src/utils/chains/solana/transaction.ts` — `sendSolanaTransaction` must NOT be wrapped
- `apps/agentic-chat/src/utils/sendTransaction.ts` — must NOT be wrapped
- `apps/agentic-chat/src/utils/swapExecutor.ts` — executor calls `sendTransaction` which must NOT be wrapped
- `apps/agentic-chat/src/utils/sendExecutor.ts` — same, must NOT be wrapped

**Step 4: Commit if any cleanup needed, otherwise done**

```bash
# Only if there were fixes
git add -A && git commit -m "chore: final cleanup for retry integration"
```

**2026-03-09T00:56:24Z**

Tasks 1,2 complete: isRetryableError() added to walletErrors.ts + withRetry() utility created with exponential backoff

**2026-03-09T00:59:33Z**

Tasks 3,4,5 complete: retry integrated into waitForConfirmedReceipt, CoW order submission, and server-side quote API calls (getBebopRate, getRelayRate)
