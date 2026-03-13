import type { DynamicToolUIPart, UIMessage } from 'ai'
import { getToolOrDynamicToolName, isToolOrDynamicToolUIPart } from 'ai'
import { memo, useMemo } from 'react'

import { Markdown } from './Markdown'
import { getToolUIComponent } from './toolUIRegistry'
import { CopyButton } from './ui/CopyButton'

interface AssistantMessageProps {
  message: UIMessage
}

export const AssistantMessage = memo(function AssistantMessage({ message }: AssistantMessageProps) {
  const textContent = useMemo(
    () =>
      message.parts
        .filter(p => p.type === 'text')
        .map(p => p.text)
        .join('\n'),
    [message.parts]
  )

  const lastTextIndex = useMemo(() => {
    for (let i = message.parts.length - 1; i >= 0; i--) {
      if (message.parts[i]?.type === 'text') return i
    }
    return -1
  }, [message.parts])

  const renderedParts = useMemo(
    () =>
      message.parts.map((part, index) => {
        if (part.type === 'text') {
          if (index === lastTextIndex && textContent) {
            return (
              <div key={`text-${index}`} className="[&>div]:contents [&>div>*:last-child]:inline">
                <Markdown>{part.text}</Markdown>
                <CopyButton
                  value={textContent}
                  className="inline-flex align-middle ml-1 opacity-0 transition-opacity group-hover/msg:opacity-100"
                />
              </div>
            )
          }
          return <Markdown key={`text-${index}`}>{part.text}</Markdown>
        }

        if (isToolOrDynamicToolUIPart(part)) {
          const toolCallId = 'toolCallId' in part ? part.toolCallId : `tool-${index}`
          const toolName = getToolOrDynamicToolName(part)
          const ToolUIComponent = getToolUIComponent(toolName)

          if (!ToolUIComponent) {
            return null
          }

          return <ToolUIComponent key={`tool-${toolCallId}`} toolPart={part as DynamicToolUIPart} />
        }

        return null
      }),
    [message.parts, lastTextIndex, textContent]
  )

  return (
    <div className="group/msg flex justify-start">
      <div className="max-w-[80%] space-y-2">{renderedParts}</div>
    </div>
  )
})
