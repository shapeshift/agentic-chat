import { ArchiveIcon, PlusIcon } from 'lucide-react'
import type { FC } from 'react'

import { TooltipIconButton } from '@/components/assistant-ui/tooltip-icon-button'
import { Button } from '@/components/ui/button'
import { useSessionId } from '@/hooks/useSessionId'
import { useThreadStore } from '@/stores/threadStore'

export const ThreadSidebar: FC = () => {
  const sessionId = useSessionId()
  const { threads, currentThreadId, createThread, switchThread, archiveThread } = useThreadStore()

  const handleNewThread = () => {
    void createThread(sessionId)
  }

  const handleArchiveThread = (threadId: string) => {
    void archiveThread(threadId)
  }

  return (
    <div className="flex flex-col items-stretch gap-1.5">
      <Button
        className="hover:bg-muted flex items-center justify-start gap-1 rounded-lg px-2.5 py-2 text-start"
        variant="ghost"
        onClick={handleNewThread}
      >
        <PlusIcon />
        New Thread
      </Button>

      <div className="flex flex-col items-stretch gap-1.5">
        {threads.map(thread => {
          const isActive = thread.id === currentThreadId
          return (
            <div
              key={thread.id}
              className={`hover:bg-muted focus-visible:bg-muted focus-visible:ring-ring flex items-center gap-2 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 ${
                isActive ? 'bg-muted' : ''
              }`}
            >
              <button className="flex-grow px-3 py-2 text-start" onClick={() => switchThread(thread.id)}>
                <p className="text-sm">{thread.title || 'New Chat'}</p>
              </button>
              <TooltipIconButton
                className="hover:text-primary text-foreground ml-auto mr-3 size-4 p-0"
                variant="ghost"
                tooltip="Archive thread"
                onClick={() => handleArchiveThread(thread.id)}
              >
                <ArchiveIcon />
              </TooltipIconButton>
            </div>
          )
        })}
      </div>
    </div>
  )
}
