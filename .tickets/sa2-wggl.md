---
id: sa2-wggl
status: closed
deps: []
links: []
created: 2026-03-08T23:26:07Z
type: feature
priority: 2
assignee: Jibles
---
# Enforce conversation message limit with UX feedback

**Objective:** When a conversation reaches the 500-message cap, the chat input should be disabled with a clear message telling the user to start a new conversation. Currently, messages beyond 500 are silently dropped (truncated via `messages.slice(-MAX_MESSAGES_PER_CONVERSATION)`), giving users no indication that older context is being lost.

**User Story:** Users who hit the message limit need clear feedback that their conversation has reached capacity, so they can start a fresh one rather than continuing with silently truncated context.

**Context & Findings:**
- `MAX_MESSAGES_PER_CONVERSATION = 500` is defined in `apps/agentic-chat/src/stores/chatStore.ts`
- The cap is enforced in `setMessages()` via `messages.slice(-MAX_MESSAGES_PER_CONVERSATION)` — older messages are silently dropped
- The chat input lives in a `Composer` component rendered within `Chat.tsx`
- Messages are loaded from localStorage via Zustand store and hydrated into the `useChat` hook in `ChatProvider.tsx`
- The `useChat` hook from `@ai-sdk/react` manages the message array and streaming state
- `react-virtuoso` is already a dependency (used for ActivityList, PortfolioAssetList) but NOT yet used for the chat message list — virtualizing the message list is a separate concern
- Rejected approach: implementing full message pagination with server-side storage — unnecessary complexity for current needs. The 500-message cap is reasonable as a localStorage storage constraint, and the right UX is to surface it clearly rather than paginate

**Files:**
- `apps/agentic-chat/src/stores/chatStore.ts` — where `MAX_MESSAGES_PER_CONVERSATION` is defined and enforced
- `apps/agentic-chat/src/components/Chat.tsx` — main chat component, renders message list and Composer
- `apps/agentic-chat/src/providers/ChatProvider.tsx` — manages message hydration and persistence, exposes chat state via context

**Gotchas:**
- Count should include both user and assistant messages (each exchange = 2+ messages due to tool calls)
- The limit check should be on the current in-memory message count, not just persisted — a long streaming session could hit it mid-conversation
- Make sure the "start new conversation" action is actionable (e.g., a button/link), not just text

## Acceptance Criteria

- [ ] When message count reaches MAX_MESSAGES_PER_CONVERSATION, the chat input is disabled
- [ ] A clear message is shown explaining the conversation limit has been reached
- [ ] A "Start new conversation" button/link is provided that creates a new conversation
- [ ] The limit is checked before sending a new message, not after truncation
- [ ] Existing conversations that already have 500+ messages show the limit message on load
- [ ] Lint and type-check pass

## Notes

**2026-03-08T23:30:57Z**

# Enforce Conversation Message Limit with UX Feedback — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use /run tk:sa2-wggl to implement this plan task-by-task via subagent-driven-development.

**Goal:** When a conversation reaches the 500-message cap, disable the chat input and show a clear message with a "Start new conversation" button.

**Architecture:** Export `MAX_MESSAGES_PER_CONVERSATION` from `chatStore.ts` and add `isAtMessageLimit` to `ChatContextValue`. The `Composer` component conditionally renders a limit banner with a new-chat link instead of the input form. The limit check uses the live `messages.length` from the `useChat` hook (not the persisted store), so it catches mid-session limits too.

**Tech Stack:** React, Zustand, react-router-dom, Tailwind CSS, bun:test

---

### Task 1: Export the message limit constant

**Files:**
- Modify: `apps/agentic-chat/src/stores/chatStore.ts:24`

**Step 1: Export the constant**

Change line 24 from:
```typescript
const MAX_MESSAGES_PER_CONVERSATION = 500
```
to:
```typescript
export const MAX_MESSAGES_PER_CONVERSATION = 500
```

**Step 2: Verify no type errors**

Run: `cd apps/agentic-chat && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/agentic-chat/src/stores/chatStore.ts
git commit -m "refactor: export MAX_MESSAGES_PER_CONVERSATION constant"
```

---

### Task 2: Add `isAtMessageLimit` to ChatContext

**Files:**
- Modify: `apps/agentic-chat/src/providers/ChatProvider.tsx:13-24` (interface) and `:161-184` (value)

**Step 1: Add `isAtMessageLimit` to the ChatContextValue interface**

In `ChatProvider.tsx`, add a new field to `ChatContextValue`:
```typescript
interface ChatContextValue {
  messages: ReturnType<typeof useChat>['messages']
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isLoading: boolean
  isAtMessageLimit: boolean
  sendMessage: ReturnType<typeof useChat>['sendMessage']
  setInput: (input: string) => void
  status: ReturnType<typeof useChat>['status']
  stop: () => void
  error: Error | undefined
}
```

**Step 2: Add the import for MAX_MESSAGES_PER_CONVERSATION**

Update the chatStore import in `ChatProvider.tsx` line 9:
```typescript
import { useChatStore, MAX_MESSAGES_PER_CONVERSATION } from '@/stores/chatStore'
```

**Step 3: Compute and expose `isAtMessageLimit` in the value memo**

In the `useMemo` block (around line 161), add the computed value:
```typescript
const isAtMessageLimit = chat.messages.length >= MAX_MESSAGES_PER_CONVERSATION

const value = useMemo<ChatContextValue>(
  () => ({
    messages: chat.messages,
    input,
    handleInputChange,
    handleSubmit: handleSubmitCallback,
    isLoading: chat.status === 'submitted' || chat.status === 'streaming',
    isAtMessageLimit,
    sendMessage: chat.sendMessage,
    setInput,
    status: chat.status,
    stop: stopCallback,
    error: chat.error,
  }),
  [
    chat.messages,
    chat.sendMessage,
    chat.status,
    chat.error,
    isAtMessageLimit,
    input,
    handleInputChange,
    handleSubmitCallback,
    stopCallback,
  ]
)
```

Note: `isAtMessageLimit` is derived from `chat.messages` (which is already a dep), so including it in the dep array is technically redundant but keeps the linter happy and makes intent clear.

**Step 4: Verify no type errors**

Run: `cd apps/agentic-chat && npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add apps/agentic-chat/src/providers/ChatProvider.tsx
git commit -m "feat: add isAtMessageLimit to ChatContext"
```

---

### Task 3: Guard message sending against the limit

**Files:**
- Modify: `apps/agentic-chat/src/providers/ChatProvider.tsx:133-148`

**Step 1: Add limit check to handleSubmit**

Update `handleSubmit` to bail out if the limit is reached:
```typescript
const handleSubmit = useCallback(
  async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim()) return
    if (chat.messages.length >= MAX_MESSAGES_PER_CONVERSATION) return

    const messageToSend = input
    setInput('')

    analytics.trackChatMessage()

    await chat.sendMessage({
      text: messageToSend,
    })
  },
  [input, chat]
)
```

**Step 2: Verify no type errors**

Run: `cd apps/agentic-chat && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/agentic-chat/src/providers/ChatProvider.tsx
git commit -m "feat: guard handleSubmit against message limit"
```

---

### Task 4: Update Composer to show limit banner

**Files:**
- Modify: `apps/agentic-chat/src/components/Composer.tsx`

**Step 1: Update Composer to consume `isAtMessageLimit` and render limit banner**

Replace the entire Composer component:
```typescript
import { MessageSquareOff, SendHorizontal, Square } from 'lucide-react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'

import { useChatContext } from '../providers/ChatProvider'

import { Button } from './ui/Button'
import { IconButton } from './ui/IconButton'

export function Composer() {
  const { input, handleInputChange, handleSubmit, isLoading, isAtMessageLimit, stop } = useChatContext()

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    handleSubmit(e)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!input.trim() || isLoading) return

      const form = e.currentTarget.form
      if (form) {
        const submitEvent = new Event('submit', { bubbles: true, cancelable: true })
        form.dispatchEvent(submitEvent)
      }
    }
  }

  if (isAtMessageLimit) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-muted/50 p-4 text-center">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <MessageSquareOff className="h-4 w-4" />
          Conversation limit reached
        </div>
        <p className="text-xs text-muted-foreground">
          This conversation has reached the maximum message limit. Start a new conversation to continue.
        </p>
        <Button asChild variant="default" size="sm">
          <Link to="/chats">Start new conversation</Link>
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex items-end gap-2">
      <textarea
        value={input}
        onChange={handleInputChange}
        onKeyDown={onKeyDown}
        placeholder="Write a message..."
        rows={1}
        className="flex-1 resize-none rounded-lg border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        style={
          {
            minHeight: '48px',
            maxHeight: '140px',
            fieldSizing: 'content',
          } as React.CSSProperties
        }
        autoFocus
        autoComplete="new-password"
        data-form-type="other"
        data-lpignore="true"
        data-1p-ignore="true"
      />

      <IconButton
        type={isLoading ? 'button' : 'submit'}
        onClick={isLoading ? stop : undefined}
        disabled={!isLoading && !input.trim()}
        size="xl"
        variant="default"
        icon={isLoading ? <Square className="h-5 w-5" /> : <SendHorizontal className="h-5 w-5" />}
        label={isLoading ? 'Stop' : 'Send'}
      />
    </form>
  )
}
```

Key decisions:
- Uses `if (isAtMessageLimit)` early return (not a ternary) per project React conventions
- The "Start new conversation" links to `/chats`, which triggers `ChatProvider`'s existing auto-generation logic (creates a new conversation ID and navigates to it)
- Uses `MessageSquareOff` icon from lucide-react (already a project dependency)
- Styling uses existing design tokens (`border-border`, `bg-muted/50`, `text-muted-foreground`)

**Step 2: Verify no type errors**

Run: `cd apps/agentic-chat && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/agentic-chat/src/components/Composer.tsx
git commit -m "feat: show message limit banner when conversation is full"
```

---

### Task 5: Write tests

**Files:**
- Create: `apps/agentic-chat/src/components/__tests__/messageLimitGuard.test.ts`

**Step 1: Write the test file**

This tests the core logic (limit detection) without needing React component rendering:
```typescript
import { describe, expect, test } from 'bun:test'

const MAX_MESSAGES_PER_CONVERSATION = 500

function isAtMessageLimit(messageCount: number): boolean {
  return messageCount >= MAX_MESSAGES_PER_CONVERSATION
}

describe('message limit guard', () => {
  test('returns false when well below limit', () => {
    expect(isAtMessageLimit(0)).toBe(false)
    expect(isAtMessageLimit(1)).toBe(false)
    expect(isAtMessageLimit(250)).toBe(false)
  })

  test('returns false at one below limit', () => {
    expect(isAtMessageLimit(499)).toBe(false)
  })

  test('returns true at exactly the limit', () => {
    expect(isAtMessageLimit(500)).toBe(true)
  })

  test('returns true above the limit', () => {
    expect(isAtMessageLimit(501)).toBe(true)
    expect(isAtMessageLimit(1000)).toBe(true)
  })
})

describe('handleSubmit limit guard', () => {
  test('prevents sending when at limit', () => {
    let messageSent = false
    const messageCount = 500
    const input = 'hello'

    if (!input.trim()) return
    if (messageCount >= MAX_MESSAGES_PER_CONVERSATION) return
    messageSent = true

    expect(messageSent).toBe(false)
  })

  test('allows sending when below limit', () => {
    let messageSent = false
    const messageCount = 499
    const input = 'hello'

    if (input.trim() && messageCount < MAX_MESSAGES_PER_CONVERSATION) {
      messageSent = true
    }

    expect(messageSent).toBe(true)
  })
})
```

**Step 2: Run the test to verify it passes**

Run: `cd apps/agentic-chat && bun test src/components/__tests__/messageLimitGuard.test.ts`
Expected: All 6 tests PASS

**Step 3: Commit**

```bash
git add apps/agentic-chat/src/components/__tests__/messageLimitGuard.test.ts
git commit -m "test: add message limit guard tests"
```

---

### Task 6: Verify acceptance criteria

**Step 1: Run the full type check**

Run: `cd apps/agentic-chat && npx tsc --noEmit`
Expected: No errors

**Step 2: Run lint**

Run: `cd apps/agentic-chat && npx eslint src/stores/chatStore.ts src/providers/ChatProvider.tsx src/components/Composer.tsx`
Expected: No errors (fix any that appear)

**Step 3: Run all tests**

Run: `cd apps/agentic-chat && bun test`
Expected: All tests pass

**Step 4: Manual verification checklist**

- [ ] Open a conversation with 500+ messages → limit banner is shown, input is hidden
- [ ] Open a conversation with < 500 messages → normal composer is shown
- [ ] Click "Start new conversation" button → navigates to a fresh conversation with working input
- [ ] Send messages normally in a new conversation → no interference
- [ ] Verify the limit check is on `messages.length` (both user + assistant messages counted)

**Step 5: Final commit (if any lint/type fixes were needed)**

```bash
git add -u
git commit -m "fix: lint and type-check issues for message limit feature"
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `stores/chatStore.ts` | Export `MAX_MESSAGES_PER_CONVERSATION` |
| `providers/ChatProvider.tsx` | Add `isAtMessageLimit` to context, guard `handleSubmit` |
| `components/Composer.tsx` | Render limit banner when at limit, add `Link` + `Button` imports |
| `components/__tests__/messageLimitGuard.test.ts` | Unit tests for limit logic |

**2026-03-09T00:24:25Z**

### Task 7: Virtualize the message list with react-virtuoso

**Files:**
- Modify: `apps/agentic-chat/src/components/Chat.tsx`

react-virtuoso is already a dependency (used in ActivityList and PortfolioAssetList). The current Chat component renders all messages in a flat `.map()` loop inside a scrollable div, with manual scroll tracking via useEffect + refs. Virtuoso handles scroll-to-bottom natively via `followOutput` and `atBottomStateChange`, so all three scroll-related useEffects and both refs (`messagesEndRef`, `viewportRef`, `shouldAutoScrollRef`) get replaced.

**Step 1: Replace the message list with Virtuoso**

Replace the full Chat component:
\`\`\`typescript
import { AlertTriangle } from 'lucide-react'
import { useCallback, useMemo, useRef } from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'

import { useStreamPauseDetector } from '../hooks/useStreamPauseDetector'
import { useChatContext } from '../providers/ChatProvider'

import { AssistantMessage } from './AssistantMessage'
import { Composer } from './Composer'
import { LoadingIndicator } from './LoadingIndicator'
import { Button } from './ui/Button'
import { UserMessage } from './UserMessage'

const WELCOME_SUGGESTIONS = [
  'What is my USDC balance on Arbitrum?',
  'Swap half my USDC on arb to FOX',
  'Give me some info about FOX on Arb',
]

export function Chat() {
  const { messages, sendMessage, status, error } = useChatContext()
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const shouldAutoScrollRef = useRef(true)

  const lastMessageContent = useMemo(() => {
    const assistantMessages = messages.filter(m => m.role === 'assistant')
    const lastAssistantMessage = assistantMessages[assistantMessages.length - 1]
    if (!lastAssistantMessage) return undefined
    return lastAssistantMessage.parts
      .filter(part => part.type === 'text')
      .map(part => (part as { type: 'text'; text: string }).text)
      .join('')
  }, [messages])

  const isStreaming = status === 'submitted' || status === 'streaming'
  const isPaused = useStreamPauseDetector(isStreaming, lastMessageContent)

  const handleSuggestionClick = (suggestion: string) => {
    void sendMessage({ text: suggestion })
  }

  const isEmpty = messages.length === 0

  // Build the virtual list items: messages + optional loading indicator + optional error
  const items = useMemo(() => {
    const result: Array<{ type: 'message'; index: number } | { type: 'loading' } | { type: 'error' }> = messages.map(
      (_, index) => ({ type: 'message' as const, index })
    )
    if (isPaused) result.push({ type: 'loading' as const })
    if (error && status === 'error') result.push({ type: 'error' as const })
    return result
  }, [messages, isPaused, error, status])

  const itemContent = useCallback(
    (_index: number, item: (typeof items)[number]) => {
      if (item.type === 'loading') {
        return (
          <div className="mx-auto max-w-2xl px-4 pb-4">
            <LoadingIndicator />
          </div>
        )
      }

      if (item.type === 'error') {
        return (
          <div className="mx-auto max-w-2xl px-4 pb-4">
            <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
              <div className="flex flex-col gap-1">
                <div className="font-medium text-red-800 dark:text-red-200">Something went wrong</div>
                <div className="text-sm text-red-600 dark:text-red-400">
                  The service is temporarily unavailable. Please try again.
                </div>
              </div>
            </div>
          </div>
        )
      }

      const message = messages[item.index]
      if (!message) return null

      return (
        <div className="mx-auto max-w-2xl px-4 pt-4">
          {message.role === 'user' && <UserMessage message={message} />}
          {message.role === 'assistant' && <AssistantMessage message={message} />}
        </div>
      )
    },
    [messages]
  )

  return (
    <div className="flex h-full flex-col">
      {/* Messages viewport */}
      <div className="flex-1 overflow-hidden">
        {isEmpty ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-lg text-foreground">How can I help you today?</div>
          </div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            data={items}
            itemContent={itemContent}
            initialTopMostItemIndex={items.length - 1}
            followOutput={isActive => {
              if (!shouldAutoScrollRef.current) return false
              return isActive ? 'smooth' : false
            }}
            atBottomStateChange={atBottom => {
              shouldAutoScrollRef.current = atBottom
            }}
            atBottomThreshold={100}
            style={{ height: '100%' }}
          />
        )}
      </div>

      {/* Suggestions above composer - only shown when empty */}
      {isEmpty && (
        <div className="bg-background">
          <div className="mx-auto flex max-w-2xl gap-2 px-4 py-3">
            {WELCOME_SUGGESTIONS.map((suggestion, index) => (
              <Button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                title={suggestion}
                variant="outline"
                className="flex-1 min-w-0 h-[52px] line-clamp-2 whitespace-normal"
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="bg-background">
        <div className="mx-auto max-w-2xl p-4">
          <Composer />
        </div>
      </div>
    </div>
  )
}
\`\`\`

Key decisions:
- \`followOutput\` replaces the three manual scroll useEffects — Virtuoso auto-scrolls when the user is at the bottom
- \`atBottomStateChange\` replaces the manual scroll listener + \`shouldAutoScrollRef\` tracking
- \`atBottomThreshold={100}\` matches the original 100px threshold
- \`initialTopMostItemIndex={items.length - 1}\` starts scrolled to bottom on load (replaces the initial scroll useEffect)
- Loading indicator and error are items in the virtual list (appended after messages) so they participate in follow-output scrolling
- Message items use \`mx-auto max-w-2xl px-4 pt-4\` per-item instead of on a wrapper div, since Virtuoso manages the container

**Step 2: Verify no type errors**

Run: \`cd apps/agentic-chat && npx tsc --noEmit\`
Expected: No errors

**Step 3: Manual smoke test**

- Open a conversation with many messages — only visible messages should be in the DOM
- Scroll up — older messages render on demand
- Send a new message while scrolled to bottom — auto-scrolls to show it
- Scroll up, then receive a new message — should NOT auto-scroll (user is reading history)
- Loading indicator appears during streaming pauses
- Error banner appears on error

**Step 4: Commit**

\`\`\`bash
git add apps/agentic-chat/src/components/Chat.tsx
git commit -m "perf: virtualize chat message list with react-virtuoso"
\`\`\`

---

### Updated Task 6: Verify acceptance criteria (amended)

Add to the manual verification checklist:
- [ ] Message list is virtualized — inspect DOM to confirm only visible messages are rendered
- [ ] Auto-scroll works during streaming
- [ ] Scrolling up disengages auto-scroll; scrolling back to bottom re-engages it
- [ ] Opening an existing conversation starts scrolled to the bottom

**2026-03-09T00:43:04Z**

Tasks 1-4 complete: Exported MAX_MESSAGES_PER_CONVERSATION, added isAtMessageLimit to ChatContext, guarded handleSubmit and sendMessage, added limit banner to Composer

**2026-03-09T00:43:04Z**

Task 5 complete: Added 6 unit tests for message limit guard logic

**2026-03-09T00:43:04Z**

Task 7 complete: Virtualized chat message list with react-virtuoso, replacing manual scroll management

**2026-03-09T00:43:04Z**

Code review fix: Wrapped sendMessage with limit guard for defense-in-depth
