import type { DynamicToolUIPart } from 'ai'
import type { ReactNode } from 'react'

import { StatusText } from '../ui/StatusText'

export type ToolUIComponentProps = {
  toolPart: DynamicToolUIPart
}

export function useToolStateRender(
  state: DynamicToolUIPart['state'],
  messages: {
    loading: ReactNode
    error: ReactNode
    success?: ReactNode
  }
) {
  if (state === 'input-streaming' || state === 'input-available') {
    return <StatusText.Loading>{messages.loading}</StatusText.Loading>
  }

  if (state === 'output-error') {
    return <StatusText.Error>{messages.error}</StatusText.Error>
  }

  if (messages.success) {
    return <StatusText.Success>{messages.success}</StatusText.Success>
  }

  return null
}
