import type { ToolCallMessagePartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { GetAllowanceInput, GetAllowanceOutput } from '@shapeshiftoss/agentic-server'
import { AlertCircle, CheckCircle } from 'lucide-react'

import { CollapsableDetails } from './CollapsableDetails'
import { StatusText } from './StatusText'

type GetAllowanceContentProps = Omit<ToolCallMessagePartProps<GetAllowanceInput, GetAllowanceOutput>, 'args'> & {
  args: Partial<GetAllowanceInput>
}

const GetAllowanceContent: React.FC<GetAllowanceContentProps> = ({ status, result, args, isError, toolName }) => {
  const isLoading = ['running', 'requires-action', 'incomplete'].includes(status.type)

  if (isLoading) {
    const message = args.asset ? `Fetching allowance for ${args.asset.symbol ?? ''}...` : 'Fetching allowance'
    return <StatusText.Loading>{message}</StatusText.Loading>
  }

  if (isError || !result) {
    return (
      <CollapsableDetails
        title={`An Error Occurred with ${toolName}`}
        leftIcon={<AlertCircle className="w-4 h-4 text-red-500" />}
      >
        <pre>{JSON.stringify(result ?? 'Failed to get allowance', null, 2)}</pre>
      </CollapsableDetails>
    )
  }

  return (
    <CollapsableDetails title="Token allowance" leftIcon={<CheckCircle className="w-4 h-4 text-primary" />}>
      <pre>{JSON.stringify(result)}</pre>
    </CollapsableDetails>
  )
}
export const GetAllowance = makeAssistantToolUI<GetAllowanceInput, GetAllowanceOutput>({
  toolName: 'getAllowance',
  render: GetAllowanceContent,
})
