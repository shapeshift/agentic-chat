import type { ToolCallContentPartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { GetAccountInput, GetAccountOutput } from '@shapeshiftoss/agentic-server'
import { chainIdToNetwork } from '@shapeshiftoss/utils'

import { TextComplete } from '@/components/TextComplete'
import { TextShimmer } from '@/components/TextShimmer'

type GetAccountContentProps = Omit<ToolCallContentPartProps<GetAccountInput, GetAccountOutput>, 'args'> & {
  args: Partial<GetAccountInput>
}

const GetAccountContent: React.FC<GetAccountContentProps> = ({ args, status, result, isError }) => {
  switch (status.type) {
    case 'running': {
      const network = args.chainId && chainIdToNetwork[args.chainId]
      if (!network) return <TextShimmer>{'Checking account details'}</TextShimmer>
      return <TextShimmer>{`Checking account details on ${network}`}</TextShimmer>
    }
    case 'complete': {
      if (isError || !result || ('code' in result && result.code === 'TOOL_EXECUTION_FAILED')) {
        const network = chainIdToNetwork[result?.chainId ?? args.chainId ?? '']
        if (!network) return <TextComplete>{'No account details discovered ❌'}</TextComplete>
        return <TextComplete>{`No account details discovered on ${network} ❌`}</TextComplete>
      }

      const network = chainIdToNetwork[result.chainId]
      return <TextComplete>{`Account details discovered on ${network} ✅`}</TextComplete>
    }
  }
}

export const GetAccount = makeAssistantToolUI<GetAccountInput, GetAccountOutput>({
  toolName: 'getAccountTool',
  render: GetAccountContent,
})
