'use client'

import type { ToolInvocationUIPart, UIMessage } from '@ai-sdk/ui-utils'
import { ArrowDown, ChevronDown } from 'lucide-react'
import React, { useMemo, useState } from 'react'
import Markdown from 'react-markdown'
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom'

import { cn } from '../lib/utils'
import type { MessageList } from '../types/message'

import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'

type ChatMessageListProps = {
  messages: MessageList
}

const ToolMessageItem: React.FC<{
  toolInvocation: ToolInvocationUIPart
}> = ({ toolInvocation }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const name = toolInvocation.toolInvocation.toolName
  const id = toolInvocation.toolInvocation.toolCallId
  const args = toolInvocation.toolInvocation.args as Record<string, unknown>
  const content =
    toolInvocation.toolInvocation.state === 'result'
      ? JSON.stringify(toolInvocation.toolInvocation.result, null, 2)
      : ''

  return (
    <div className="flex flex-col items-start max-w-[75%]">
      <div className="w-full mb-2 border rounded-lg overflow-hidden bg-muted">
        <div
          className="flex justify-between items-center px-3 py-2 border-b bg-muted/70 cursor-pointer hover:bg-muted/90 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className="font-semibold text-sm">{name}</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{id}</span>
            <ChevronDown className={cn('h-4 w-4 transition-transform', isExpanded ? 'transform rotate-180' : '')} />
          </div>
        </div>
        {isExpanded && (
          <>
            {Object.entries(args).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center px-3 py-2 border-b">
                <span className="font-semibold text-xs text-muted-foreground">{key}</span>
                <span className="text-xs text-muted-foreground/80 break-all">
                  {typeof value === 'string' ? value : JSON.stringify(value)}
                </span>
              </div>
            ))}
            {content && (
              <div className="px-3 py-2 text-xs text-muted-foreground/80 break-all">
                {typeof content === 'string' ? content : JSON.stringify(content)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const ChatMessageItem: React.FC<{
  message: UIMessage
}> = ({ message }) => {
  const toolMessageItems = message.parts
    .filter(part => part.type === 'tool-invocation')
    .map((toolInvocation, i) => <ToolMessageItem key={i} toolInvocation={toolInvocation} />)
  return (
    <>
      {toolMessageItems}
      <div key={message.id} className="flex">
        <div
          className={cn(
            'inline-block max-w-[75%] rounded-lg px-3 py-2 text-sm break-words whitespace-pre-wrap',
            message.role === 'user' ? 'ml-auto bg-primary text-primary-foreground' : 'bg-muted'
          )}
        >
          {<Markdown>{message.content}</Markdown>}
        </div>
      </div>
    </>
  )
}

const StickyToBottomContent = ({ content, className }: { content: React.ReactNode; className?: string }) => {
  const context = useStickToBottomContext()

  return (
    <div ref={context.scrollRef} style={{ width: '100%', height: '100%' }} className={className}>
      <div ref={context.contentRef}>{content}</div>
    </div>
  )
}

const ScrollToBottom = () => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext()
  const handleScrollToBottomClick = useMemo(() => () => scrollToBottom(), [scrollToBottom])

  if (isAtBottom) return null

  return (
    <Button
      onClick={() => void handleScrollToBottomClick()}
      className="absolute bottom-4 right-4 animate-in fade-in-0 zoom-in-95 cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors shadow-md hover:shadow-lg"
      size="sm"
      variant="outline"
    >
      <ArrowDown className="h-4 w-4 mr-2" />
      Scroll to bottom
    </Button>
  )
}

export const ChatMessageList = ({ messages }: ChatMessageListProps) => (
  <div className="relative">
    <StickToBottom className="h-[calc(100vh-8rem)]">
      <StickyToBottomContent
        className="absolute inset-0 overflow-y-scroll"
        content={
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {messages.map(message => {
                return <ChatMessageItem key={message.id} message={message} />
              })}
            </div>
          </ScrollArea>
        }
      />
      <ScrollToBottom />
    </StickToBottom>
  </div>
)
