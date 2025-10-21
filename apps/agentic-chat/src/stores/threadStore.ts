import { create } from 'zustand'

export type Thread = {
  id: string
  resourceId: string
  title: string
  metadata: string | null
  createdAt: string
  updatedAt: string
}

type ThreadMetadata = {
  createdWithWallet?: string
}

type ThreadStore = {
  threads: Thread[]
  currentThreadId: string | null
  isLoading: boolean
  error: string | null
  titlePollingIntervals: Map<string, NodeJS.Timeout>

  setThreads: (threads: Thread[]) => void
  setCurrentThreadId: (threadId: string | null) => void
  setIsLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void

  fetchThreads: (resourceId: string) => Promise<void>
  createThread: (resourceId: string, metadata?: ThreadMetadata) => Promise<Thread>
  switchThread: (threadId: string) => void
  setThreadTitle: (threadId: string, title: string) => void
  renameThread: (threadId: string, title: string) => Promise<void>
  archiveThread: (threadId: string) => Promise<void>
  getThreadMetadata: (threadId: string) => ThreadMetadata | null
  startTitlePolling: (resourceId: string, threadId: string) => void
  stopTitlePolling: (threadId: string) => void
}

const API_BASE_URL = import.meta.env.VITE_AGENTIC_SERVER_BASE_URL

export const useThreadStore = create<ThreadStore>((set, get) => ({
  threads: [],
  currentThreadId: null,
  isLoading: false,
  error: null,
  titlePollingIntervals: new Map(),

  setThreads: threads => set({ threads }),
  setCurrentThreadId: currentThreadId => set({ currentThreadId }),
  setIsLoading: isLoading => set({ isLoading }),
  setError: error => set({ error }),

  fetchThreads: async resourceId => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch(`${API_BASE_URL}/api/threads?resourceId=${encodeURIComponent(resourceId)}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch threads: ${response.statusText}`)
      }
      const data = (await response.json()) as { threads: Thread[] }
      console.log('[ThreadStore] Fetched threads from API:', {
        count: data.threads?.length || 0,
        threads: data.threads,
      })
      set({ threads: data.threads || [], isLoading: false })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch threads'
      set({ error: errorMessage, isLoading: false })
      console.error('[ThreadStore] Error fetching threads:', error)
    }
  },

  createThread: (resourceId, metadata) => {
    const threadId = `thread-${crypto.randomUUID()}`
    const now = new Date().toISOString()

    const newThread: Thread = {
      id: threadId,
      resourceId,
      title: 'New Chat',
      metadata: metadata ? JSON.stringify(metadata) : null,
      createdAt: now,
      updatedAt: now,
    }

    console.log('[ThreadStore] Creating new thread locally:', { threadId, resourceId })

    set(state => ({
      threads: [...state.threads, newThread],
      currentThreadId: threadId,
    }))

    return Promise.resolve(newThread)
  },

  switchThread: threadId => {
    set({ currentThreadId: threadId })
  },

  setThreadTitle: (threadId, title) => {
    set(state => ({
      threads: state.threads.map(t => (t.id === threadId ? { ...t, title, updatedAt: new Date().toISOString() } : t)),
    }))
  },

  renameThread: async (threadId, title) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/threads/${threadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      if (!response.ok) {
        throw new Error(`Failed to rename thread: ${response.statusText}`)
      }
      const data = (await response.json()) as { thread: Thread }
      const updatedThread = data.thread
      set(state => ({
        threads: state.threads.map(t => (t.id === threadId ? updatedThread : t)),
      }))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to rename thread'
      set({ error: errorMessage })
      console.error('[ThreadStore] Error renaming thread:', error)
      throw error
    }
  },

  // eslint-disable-next-line @typescript-eslint/require-await
  archiveThread: async threadId => {
    try {
      set(state => ({
        threads: state.threads.filter(t => t.id !== threadId),
        currentThreadId: state.currentThreadId === threadId ? null : state.currentThreadId,
      }))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to archive thread'
      set({ error: errorMessage })
      console.error('[ThreadStore] Error archiving thread:', error)
      throw error
    }
  },

  getThreadMetadata: threadId => {
    const thread = get().threads.find(t => t.id === threadId)
    if (!thread?.metadata) return null
    try {
      return JSON.parse(thread.metadata) as ThreadMetadata
    } catch {
      return null
    }
  },

  startTitlePolling: (resourceId, threadId) => {
    const existingInterval = get().titlePollingIntervals.get(threadId)
    if (existingInterval) {
      console.log('[ThreadStore] Title polling already active for thread:', threadId)
      return
    }

    console.log('[ThreadStore] Starting title polling for thread:', threadId)
    let pollCount = 0
    const maxPolls = 15

    const interval = setInterval(() => {
      void (async () => {
        pollCount++
        console.log(`[ThreadStore] Polling attempt ${pollCount}/${maxPolls} for thread:`, threadId)

        try {
          const response = await fetch(`${API_BASE_URL}/api/threads?resourceId=${encodeURIComponent(resourceId)}`)
          if (response.ok) {
            const data = (await response.json()) as { threads: Thread[] }
            const updatedThread = data.threads.find(t => t.id === threadId)

            console.log('[ThreadStore] Poll result:', {
              threadId,
              found: !!updatedThread,
              title: updatedThread?.title,
            })

            if (updatedThread && updatedThread.title !== 'New Chat') {
              // Clean up title - remove surrounding quotes if present
              let cleanTitle = updatedThread.title
              try {
                // If title is a JSON string, parse it to remove quotes
                if (cleanTitle.startsWith('"') && cleanTitle.endsWith('"')) {
                  cleanTitle = JSON.parse(cleanTitle)
                }
              } catch {
                // If parsing fails, keep original
              }

              console.log('[ThreadStore] Title generated! Updating thread:', {
                threadId,
                originalTitle: updatedThread.title,
                cleanTitle,
              })

              set(state => {
                // Check if thread exists in store
                const existingThreadIndex = state.threads.findIndex(t => t.id === threadId)
                let newThreads: Thread[]

                if (existingThreadIndex >= 0) {
                  // Update existing thread
                  newThreads = state.threads.map(t => (t.id === threadId ? { ...updatedThread, title: cleanTitle } : t))
                  console.log('[ThreadStore] Updated existing thread in store')
                } else {
                  // Add new thread to store
                  newThreads = [...state.threads, { ...updatedThread, title: cleanTitle }]
                  console.log('[ThreadStore] Added new thread to store')
                }

                console.log('[ThreadStore] Updated store threads:', newThreads)
                return { threads: newThreads }
              })
              get().stopTitlePolling(threadId)
            }
          }
        } catch (error) {
          console.error('[ThreadStore] Error polling for title:', error)
        }

        if (pollCount >= maxPolls) {
          console.log('[ThreadStore] Max polls reached, stopping polling for thread:', threadId)
          get().stopTitlePolling(threadId)
        }
      })()
    }, 2000)

    set(state => {
      const newIntervals = new Map(state.titlePollingIntervals)
      newIntervals.set(threadId, interval)
      return { titlePollingIntervals: newIntervals }
    })
  },

  stopTitlePolling: threadId => {
    const interval = get().titlePollingIntervals.get(threadId)
    if (interval) {
      clearInterval(interval)
      set(state => {
        const newIntervals = new Map(state.titlePollingIntervals)
        newIntervals.delete(threadId)
        return { titlePollingIntervals: newIntervals }
      })
    }
  },
}))
