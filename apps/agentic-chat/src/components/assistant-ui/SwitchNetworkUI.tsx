import type { ToolCallMessagePartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { SwitchNetworkInput, SwitchNetworkOutput } from '@shapeshiftoss/agentic-server'
import { ArrowRightLeft } from 'lucide-react'

import { useNetworkSwitch } from '@/hooks/useNetworkSwitch'

import { CollapsableDetails } from './CollapsableDetails'
import { StatusText } from './StatusText'

const Icon = ArrowRightLeft

type SwitchNetworkContentProps = Omit<ToolCallMessagePartProps<SwitchNetworkInput, SwitchNetworkOutput>, 'args'> & {
  args: Partial<SwitchNetworkInput>
}

const isToolExecutionFailed = (
  result: SwitchNetworkOutput | { code: string; message?: string } | null | undefined
): boolean => {
  return !result || ('code' in result && result.code === 'TOOL_EXECUTION_FAILED')
}

const ErrorDetails: React.FC<{ title: string; message: string }> = ({ title, message }) => (
  <CollapsableDetails title={title} leftIcon={<Icon className="w-4 h-4 text-red-500" />}>
    {message}
  </CollapsableDetails>
)

const SwitchNetworkContent: React.FC<SwitchNetworkContentProps> = ({ status, result, toolCallId }) => {
  const networkData = status.type === 'complete' && result && !isToolExecutionFailed(result) ? result : null
  const { phase, error } = useNetworkSwitch(toolCallId, networkData)

  if (status.type === 'running') {
    return <StatusText.Loading>Preparing network switch...</StatusText.Loading>
  }

  if (isToolExecutionFailed(result)) {
    const message = result && 'message' in result ? String(result.message) : 'Unknown error'
    return <ErrorDetails title="Failed to prepare network switch" message={message} />
  }

  if (phase === 'error') {
    return <ErrorDetails title="Network switch failed" message={error || 'Unknown error'} />
  }

  if (phase === 'switching' || phase === 'idle') {
    return <StatusText.Loading>Switching to {result!.networkName}...</StatusText.Loading>
  }

  return (
    <StatusText.WithIcon>
      <StatusText.Icon icon={Icon} className="text-green-500" />
      <StatusText.Text>Switched to {result!.networkName}</StatusText.Text>
    </StatusText.WithIcon>
  )
}

export const SwitchNetworkUI = makeAssistantToolUI<SwitchNetworkInput, SwitchNetworkOutput>({
  toolName: 'switchNetworkTool',
  render: SwitchNetworkContent,
})
