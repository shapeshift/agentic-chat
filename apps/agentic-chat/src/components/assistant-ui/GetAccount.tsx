import type { ToolCallMessagePartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { GetAccountInput, GetAccountOutput } from '@shapeshiftoss/agentic-server'

import { StatusText } from './StatusText'

type GetAccountContentProps = Omit<ToolCallMessagePartProps<GetAccountInput, GetAccountOutput>, 'args'> & {
  args: Partial<GetAccountInput>
}

const GetAccountContent: React.FC<GetAccountContentProps> = ({ args, status, result, isError }) => {
  const accountDetailsText = (() => {
    const parts = ['account details']
    if (args.account) parts.push(`for ${args.account}`)
    if (args.network) parts.push(`on ${args.network}`)
    return parts.join(' ')
  })()

  switch (status.type) {
    case 'running': {
      return <StatusText.Loading>{`Checking ${accountDetailsText}`}</StatusText.Loading>
    }
    case 'complete': {
      if (isError || !result || ('code' in result && result.code === 'TOOL_EXECUTION_FAILED')) {
        return <StatusText.Error>{`Failed to find ${accountDetailsText} ❌`}</StatusText.Error>
      }

      return <StatusText.Success>{`Found ${accountDetailsText} ✅`}</StatusText.Success>
    }
  }
}

export const GetAccount = makeAssistantToolUI<GetAccountInput, GetAccountOutput>({
  toolName: 'getAccountTool',
  render: GetAccountContent,
})
