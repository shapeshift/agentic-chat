import type { useChat } from '@ai-sdk/react'

export type Message = ReturnType<typeof useChat>['messages'][number]
