import type { DynamicToolUIPart, ToolUIPart } from 'ai'
import { getToolOrDynamicToolName } from 'ai'

import { getToolUIComponent } from './toolUIRegistry'

interface ToolInvocationRendererProps {
  toolPart: DynamicToolUIPart | ToolUIPart
}

export function ToolInvocationRenderer({ toolPart }: ToolInvocationRendererProps) {
  const toolName = getToolOrDynamicToolName(toolPart)

  const ToolUIComponent = getToolUIComponent(toolName)

  if (!ToolUIComponent) {
    return null
  }

  return <ToolUIComponent toolPart={toolPart as DynamicToolUIPart} />
}
