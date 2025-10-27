import type { DynamicToolUIPart, UIMessage } from 'ai'
import { getToolOrDynamicToolName, isToolOrDynamicToolUIPart } from 'ai'

import { Markdown } from './Markdown'
import { getToolUIComponent } from './toolUIRegistry'

interface AssistantMessageProps {
  message: UIMessage
}

export function AssistantMessage({ message }: AssistantMessageProps) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] space-y-2">
        {message.parts.map((part, index) => {
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
        })}
      </div>
    </div>
  )
}
