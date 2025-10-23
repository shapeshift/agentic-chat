import type { UIMessage } from 'ai'
import { isToolOrDynamicToolUIPart } from 'ai'

import { Markdown } from './Markdown'
import { ToolInvocationRenderer } from './ToolInvocationRenderer'

interface AssistantMessageProps {
  message: UIMessage
}

export function AssistantMessage({ message }: AssistantMessageProps) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] space-y-2">
        {message.parts.map((part, index) => {
          if (part.type === 'text') {
            return <Markdown key={index}>{part.text}</Markdown>
          }

          if (isToolOrDynamicToolUIPart(part)) {
            const toolCallId = 'toolCallId' in part ? part.toolCallId : `tool-${index}`
            return <ToolInvocationRenderer key={toolCallId} toolPart={part} />
          }

          return null
        })}
      </div>
    </div>
  )
}
