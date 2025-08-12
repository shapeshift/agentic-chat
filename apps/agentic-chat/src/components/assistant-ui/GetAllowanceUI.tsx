import type { ToolCallContentPartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { GetAllowanceInput, GetAllowanceOutput } from '@shapeshiftoss/agentic-server'
import { AlertCircle, CheckCircle } from 'lucide-react'

import { TextShimmer } from '@/components/TextShimmer'

import { CollapsableDetails } from './CollapsableDetails'

type GetAllowanceContentProps = Omit<ToolCallContentPartProps<GetAllowanceInput, GetAllowanceOutput>, 'args'> & {
  args: Partial<GetAllowanceInput>
}

const GetAllowanceContent: React.FC<GetAllowanceContentProps> = ({ status, result, args, isError, toolName }) => {
  switch (status.type) {
    case 'running':
    case 'requires-action':
    case 'incomplete': {
      if (!args.asset) {
        return <TextShimmer>Fetching allowance</TextShimmer>
      }

      return <TextShimmer>Fetching allowance for {args.asset.symbol ?? ''}...</TextShimmer>
    }
    case 'complete': {
      if (isError || !result) {
        return (
          <CollapsableDetails
            title={`An Error Occured with ${toolName}`}
            leftIcon={<AlertCircle className="w-4 h-4 text-red-500" />}
          >
            {JSON.stringify(result || 'Failed to get allowance')}
          </CollapsableDetails>
        )
      }
      return (
        <CollapsableDetails title="Token allowance" leftIcon={<CheckCircle className="w-4 h-4 text-primary" />}>
          <pre>{JSON.stringify(result)}</pre>
        </CollapsableDetails>
      )
    }
  }
}
const GetAllowanceUI = makeAssistantToolUI<GetAllowanceInput, GetAllowanceOutput>({
  toolName: 'getAllowance',
  render: GetAllowanceContent,
})

export default GetAllowanceUI
