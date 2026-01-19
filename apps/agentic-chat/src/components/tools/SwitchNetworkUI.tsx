import type { SwitchNetworkOutput } from '@shapeshiftoss/agentic-server'
import { useChatStore } from '@shapeshiftoss/chat'
import { ArrowRightLeft } from 'lucide-react'

import { useNetworkSwitch } from '@/hooks/useNetworkSwitch'

import { CollapsableDetails } from '../ui/CollapsableDetails'
import { StatusText } from '../ui/StatusText'

import { useToolStateRender } from './toolUIHelpers'
import type { ToolUIComponentProps } from './toolUIHelpers'

const Icon = ArrowRightLeft

const ErrorDetails: React.FC<{ title: string; message: string }> = ({ title, message }) => (
  <CollapsableDetails title={title} leftIcon={<Icon className="w-4 h-4 text-red-500" />}>
    {message}
  </CollapsableDetails>
)

export function SwitchNetworkUI({ toolPart }: ToolUIComponentProps) {
  const { state, output, toolCallId, errorText } = toolPart
  const networkOutput = output as SwitchNetworkOutput | undefined
  const { isHistorical, getPersistedTransaction } = useChatStore()

  const networkData = state === 'output-available' && networkOutput ? networkOutput : null
  const { phase, error } = useNetworkSwitch(toolCallId, networkData)

  const stateRender = useToolStateRender(state, {
    loading: 'Preparing network switch...',
    error: null,
  })

  if (stateRender) return stateRender

  if (state === 'output-error') {
    const message = errorText || 'Unknown error'
    return <ErrorDetails title="Failed to prepare network switch" message={message} />
  }

  if (phase === 'error') {
    return <ErrorDetails title="Network switch failed" message={error || 'Unknown error'} />
  }

  if (isHistorical(toolCallId) && !getPersistedTransaction(toolCallId)) {
    return <StatusText>⏭️ Network switch skipped (no saved data)</StatusText>
  }

  if (phase === 'switching' || phase === 'idle') {
    return <StatusText.Loading>Switching to {networkOutput?.network ?? ''}...</StatusText.Loading>
  }

  return (
    <StatusText.WithIcon>
      <StatusText.Icon icon={Icon} className="text-green-500" />
      <StatusText.Text>Switched to {networkOutput?.network ?? ''}</StatusText.Text>
    </StatusText.WithIcon>
  )
}
