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
  const renderedParts = useMemo(
    () =>
      message.parts.map((part, index) => {
        if (part.type === 'text') {
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
    [message.parts]
  )

  const textContent = useMemo(
    () =>
      message.parts
        .filter(p => p.type === 'text')
        .map(p => p.text)
        .join('\n'),
    [message.parts]
  )

  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] space-y-2">
        {renderedParts}
        {textContent && <CopyButton value={textContent} />}
      </div>
    </div>
  )
})
