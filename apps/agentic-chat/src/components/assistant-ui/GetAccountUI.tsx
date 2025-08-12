import type { ToolCallContentPartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { GetAccountInput, GetAccountOutput } from '@shapeshiftoss/agentic-server'
import { chainIdToNetwork } from '@shapeshiftoss/utils'
import { Wallet } from 'lucide-react'

import { TextShimmer } from '@/components/TextShimmer'

import { CollapsableDetails } from './CollapsableDetails'

const Icon = Wallet

type GetAccountUiContentProps = Omit<ToolCallContentPartProps<GetAccountInput, GetAccountOutput>, 'args'> & {
  args: Partial<GetAccountInput>
}

const GetAccountUiContent: React.FC<GetAccountUiContentProps> = ({ status, result, args, isError, toolName }) => {
  switch (status.type) {
    case 'running':
    case 'requires-action':
    case 'incomplete': {
      if (!args.chainId) return <TextShimmer>Getting account</TextShimmer>

      return <TextShimmer>Getting account for {chainIdToNetwork[args.chainId]}...</TextShimmer>
    }
    case 'complete': {
      if (isError || !result) {
        return (
          <CollapsableDetails
            title={`An error occurred with ${toolName}`}
            leftIcon={<Icon className="w-4 h-4 text-red-500" />}
          >
            {JSON.stringify(result || 'Failed to get account details')}
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
}

const GetAccountUI = makeAssistantToolUI<GetAccountInput, GetAccountOutput>({
  toolName: 'getAccount',
  render: GetAccountUiContent,
})

export default GetAccountUI
