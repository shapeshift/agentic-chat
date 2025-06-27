import type { ToolCallContentPartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import { Wallet } from 'lucide-react'

import type { GetAccountParams, GetAccountResult } from '../../tools/getAccount'
import { TextShimmer } from '../TextShimmer'

import { CollapsableDetails } from './CollapsableDetails'

const Icon = Wallet

type GetAccountUiContentProps = Omit<ToolCallContentPartProps<GetAccountParams, GetAccountResult>, 'args'> & {
  args: Partial<GetAccountParams>
}

const GetAccountUiContent: React.FC<GetAccountUiContentProps> = ({ status, result, args, isError, toolName }) => {
  switch (status.type) {
    case 'running':
    case 'requires-action':
    case 'incomplete': {
      if (!args.network) return <TextShimmer>Getting account</TextShimmer>

      return <TextShimmer>Getting account for {args.network}...</TextShimmer>
    }
    case 'complete':
      if (isError) {
        return (
          <CollapsableDetails
            title={`An error occurred with ${toolName}`}
            leftIcon={<Icon className="w-4 h-4 text-red-500" />}
          >
            {JSON.stringify(result)}
          </CollapsableDetails>
        )
      }
      return (
        <CollapsableDetails title="Account details" leftIcon={<Icon className="w-4 h-4 text-green-500" />}>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </CollapsableDetails>
      )
  }
}

const GetAccountUI = makeAssistantToolUI<GetAccountParams, GetAccountResult>({
  toolName: 'getAccount',
  render: GetAccountUiContent,
})

export default GetAccountUI
