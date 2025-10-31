import type { SwitchNetworkOutput } from '@shapeshiftoss/agentic-server'
import type { DynamicToolUIPart } from 'ai'
import { ArrowRightLeft } from 'lucide-react'

import { useNetworkSwitch } from '@/hooks/useNetworkSwitch'
import { useToolExecutionStore } from '@/stores/toolExecutionStore'

import { CollapsableDetails } from '../ui/CollapsableDetails'
import { StatusText } from '../ui/StatusText'

const Icon = ArrowRightLeft

const ErrorDetails: React.FC<{ title: string; message: string }> = ({ title, message }) => (
  <CollapsableDetails title={title} leftIcon={<Icon className="w-4 h-4 text-red-500" />}>
    {message}
  </CollapsableDetails>
)

interface SwitchNetworkUIProps {
  toolPart: DynamicToolUIPart
}

export function SwitchNetworkUI({ toolPart }: SwitchNetworkUIProps) {
  const { state, output, toolCallId, errorText } = toolPart
  const networkOutput = output as SwitchNetworkOutput | undefined
  const { isHistorical, getPersistedState } = useToolExecutionStore()

  const networkData = state === 'output-available' && networkOutput ? networkOutput : null
  const { phase, error } = useNetworkSwitch(toolCallId, networkData)

  if (state === 'input-streaming' || state === 'input-available') {
    return <StatusText.Loading>Preparing network switch...</StatusText.Loading>
  }

  if (state === 'output-error') {
    const message = errorText || 'Unknown error'
    return <ErrorDetails title="Failed to prepare network switch" message={message} />
  }

  if (phase === 'error') {
    return <ErrorDetails title="Network switch failed" message={error || 'Unknown error'} />
  }

  if (isHistorical(toolCallId) && !getPersistedState(toolCallId)) {
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
