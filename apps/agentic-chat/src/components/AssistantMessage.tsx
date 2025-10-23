import type { DynamicToolUIPart, UIMessage } from 'ai'

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

          if (part.type === 'dynamic-tool' || part.type.startsWith('tool-')) {
            const toolCallId = 'toolCallId' in part ? part.toolCallId : `tool-${index}`
            return <ToolInvocationRenderer key={toolCallId} toolPart={part as DynamicToolUIPart} />
          }

          // Ignore step-start and other internal message types
          return null
        })}
      </div>
    </div>
  )
}
