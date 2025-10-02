import type { unstable_RemoteThreadListAdapter, ThreadMessage } from '@assistant-ui/react'
import { createAssistantStream } from 'assistant-stream'

const BACKEND_URL = import.meta.env.VITE_AGENTIC_SERVER_BASE_URL

export const createMastraThreadAdapter = (resourceId: string): unstable_RemoteThreadListAdapter => ({
  async list() {
    const response = await fetch(`${BACKEND_URL}/api/threads?resourceId=${encodeURIComponent(resourceId)}`)

    if (!response.ok) {
      throw new Error(`Failed to fetch threads: ${response.statusText}`)
    }

    const data = (await response.json()) as {
      threads: Array<{
        remoteId: string
        externalId?: string
        title?: string
        status: 'regular' | 'archived'
      }>
    }

    return {
      threads: data.threads.map(thread => ({
        remoteId: thread.remoteId,
        externalId: thread.externalId,
        title: thread.title ?? 'New Chat',
        status: thread.status,
      })),
    }
  },

  async rename(remoteId: string, newTitle: string) {
    const response = await fetch(`${BACKEND_URL}/api/threads/${remoteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle }),
    })

    if (!response.ok) {
      throw new Error(`Failed to rename thread: ${response.statusText}`)
    }
  },

  async archive(remoteId: string) {
    const response = await fetch(`${BACKEND_URL}/api/threads/${remoteId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`Failed to archive thread: ${response.statusText}`)
    }
  },

  async unarchive(_remoteId: string) {
    // Not implemented yet
  },

  async delete(remoteId: string) {
    const response = await fetch(`${BACKEND_URL}/api/threads/${remoteId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`Failed to delete thread: ${response.statusText}`)
    }
  },

  async initialize(threadId: string) {
    const response = await fetch(`${BACKEND_URL}/api/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resourceId,
        metadata: { threadId },
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to create thread: ${response.statusText}`)
    }

    const data = (await response.json()) as {
      remoteId: string
      externalId?: string
    }

    return {
      remoteId: data.remoteId,
      externalId: data.externalId,
    }
  },

  async generateTitle(remoteId: string, unstable_messages: readonly ThreadMessage[]) {
    const simplifiedMessages = unstable_messages.map(msg => ({
      role: msg.role,
      content:
        typeof msg.content === 'string'
          ? msg.content
          : msg.content
              .map((part: { type: string; text?: string }) => {
                if (part.type === 'text') return part.text ?? ''
                return ''
              })
              .join(' '),
    }))

    const response = await fetch(`${BACKEND_URL}/api/threads/${remoteId}/generate-title`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: simplifiedMessages }),
    })

    if (!response.ok) {
      throw new Error(`Failed to generate title: ${response.statusText}`)
    }

    const data = (await response.json()) as { title: string }

    return createAssistantStream(controller => {
      controller.appendText(data.title)
      controller.close()
    })
  },
})
