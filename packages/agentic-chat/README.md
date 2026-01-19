# @shapeshiftoss/chat

> **Note**: This package is primarily intended for internal use within ShapeShift projects. It's published publicly to facilitate code sharing between the [shapeshift-agentic](https://github.com/shapeshift/shapeshift-agentic) and [shapeshift web](https://github.com/shapeshift/web) repositories. While open source, it's not designed as a general-purpose library for external consumption.

Reusable chat infrastructure for ShapeShift agentic applications. Provides conversation management, tool state tracking, step utilities, and a controlled ChatProvider component.

## Installation

```bash
npm install @shapeshiftoss/chat
# or
yarn add @shapeshiftoss/chat
# or
bun add @shapeshiftoss/chat
```

## Features

- **ChatProvider**: Controlled React component for managing chat conversations
- **Conversation Management**: Create, persist, and delete conversations
- **Tool State Tracking**: Track historical tool executions and runtime state
- **Step Utilities**: Generic step-based state machine utilities
- **Message Persistence**: LocalStorage-based message storage
- **TypeScript**: Full TypeScript support with exported types

## Quick Start

```typescript
import { ChatProvider, useChatContext, useChatStore } from '@shapeshiftoss/chat'

function App() {
  const [conversationId, setConversationId] = useState<string>()

  return (
    <ChatProvider
      conversationId={conversationId}
      walletState={{
        evmAddress: '0x...',
        solanaAddress: 'ABC...',
        approvedChainIds: ['1', '10', '42161'],
      }}
      onConversationDelete={id => {
        if (id === conversationId) {
          setConversationId(generateConversationId())
        }
      }}
      apiBaseUrl="https://your-api.example.com"
    >
      <YourChatUI />
    </ChatProvider>
  )
}

function YourChatUI() {
  const { messages, isLoading, input, setInput, handleSubmit } = useChatContext()

  return (
    <div>
      {messages.map(message => (
        <div key={message.id}>{message.content}</div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={e => setInput(e.target.value)} />
      </form>
    </div>
  )
}
```

## API Reference

### ChatProvider

Controlled provider component for managing chat state.

**Props:**
- `conversationId: string | undefined` - Current conversation ID
- `walletState: WalletState` - Wallet connection state (addresses, chain IDs)
- `onConversationDelete?: (id: string) => void` - Callback when conversation deleted
- `apiBaseUrl: string` - Base URL for chat API
- `children: ReactNode` - Child components

### useChatContext()

Access chat context (messages, input, handlers).

**Returns:**
```typescript
{
  messages: Message[]
  isLoading: boolean
  input: string
  setInput: (value: string) => void
  handleSubmit: (e: FormEvent) => void
  stop: () => void
}
```

### useChatStore()

Access Zustand store for conversation and tool state management.

**Store State:**
```typescript
{
  conversations: Conversation[]
  historicalToolIds: Set<string>
  runtimeToolStates: Map<string, unknown>
  persistedTransactions: PersistedToolState[]

  saveConversation: (id: string, title: string) => void
  deleteConversation: (id: string) => void
  markAsHistorical: (toolCallIds: string[]) => void
  isHistorical: (toolCallId: string) => boolean
  // ... more methods
}
```

### useToolExecutionEffect()

Generic hook for orchestrating tool execution with state persistence.

**Usage:**
```typescript
const { state, setState } = useToolExecutionEffect(
  toolCallId,
  toolData,
  initialState,
  async (data, setState) => {
    // Your execution logic
    setState(draft => {
      draft.currentStep = 1
      draft.completedSteps.add(0)
    })
  }
)
```

### Step Utilities

**createStepPhaseMap()** - Create bidirectional mapping between numeric steps and string phases:

```typescript
const SWAP_PHASES = createStepPhaseMap<SwapStep>({
  [SwapStep.QUOTE]: 'quote_complete',
  [SwapStep.APPROVAL]: 'approval_complete',
  [SwapStep.SWAP]: 'swap_complete',
})

// Convert to phases
const phases = SWAP_PHASES.toPhases(completedSteps, error)

// Convert from phases
const steps = SWAP_PHASES.fromPhases(phases)
```

**getStepStatus()** - Get status for a specific step:

```typescript
const status = getStepStatus(SwapStep.APPROVAL, state)
// Returns: StepStatus.IN_PROGRESS | COMPLETE | FAILED | SKIPPED | NOT_STARTED
```

### Message Storage

Direct localStorage access for messages (avoiding Zustand size limits):

```typescript
import { saveMessages, loadMessages, deleteMessages } from '@shapeshiftoss/chat'

saveMessages('conversation-id', messages)
const messages = loadMessages('conversation-id')
deleteMessages('conversation-id')
```

### Utilities

```typescript
import { generateConversationId, extractTitleFromMessages } from '@shapeshiftoss/chat'

const id = generateConversationId()  // crypto.randomUUID()
const title = extractTitleFromMessages(messages, conversations, conversationId)
```

## Types

```typescript
import type {
  Conversation,
  Message,
  PersistedToolState,
  StepState,
} from '@shapeshiftoss/chat'
```

## Design Patterns

### Tool Execution Hook Pattern

The package provides compositional utilities for building tool execution hooks. Here's the recommended pattern:

```typescript
import {
  useToolExecutionEffect,
  createStepPhaseMap,
  getStepStatus,
  useChatStore,
  useChatContext,
} from '@shapeshiftoss/chat'

enum MyToolStep {
  PREPARE = 0,
  EXECUTE = 1,
  COMPLETE = 2,
}

const PHASES = createStepPhaseMap<MyToolStep>({
  [MyToolStep.PREPARE]: 'prepared',
  [MyToolStep.EXECUTE]: 'executed',
})

export function useMyToolExecution(toolCallId: string, data: MyToolData | null) {
  const { state } = useToolExecutionEffect(
    toolCallId,
    data,
    { currentStep: MyToolStep.PREPARE, completedSteps: new Set() },
    async (data, setState) => {
      // Step 1: Preparation
      setState(draft => {
        draft.completedSteps.add(MyToolStep.PREPARE)
        draft.currentStep = MyToolStep.EXECUTE
      })

      // Step 2: Execution (your wallet-specific code)
      await executeWithYourWallet(data)

      setState(draft => {
        draft.completedSteps.add(MyToolStep.EXECUTE)
        draft.currentStep = MyToolStep.COMPLETE
      })
    }
  )

  return {
    steps: [
      { step: MyToolStep.PREPARE, status: getStepStatus(MyToolStep.PREPARE, state) },
      { step: MyToolStep.EXECUTE, status: getStepStatus(MyToolStep.EXECUTE, state) },
    ],
    error: state.error,
  }
}
```

See the [main repository](https://github.com/shapeshift/shapeshift-agentic) for complete examples.

## License

MIT

## Repository

<https://github.com/shapeshift/shapeshift-agentic>
