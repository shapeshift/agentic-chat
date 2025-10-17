import type { ToolCallMessagePartProps } from '@assistant-ui/react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import type { GetTransactionHistoryInput, GetTransactionHistoryOutput } from '@shapeshiftoss/agentic-server'
import { History } from 'lucide-react'

import { StatusText } from './StatusText'

const Icon = History

type GetTransactionHistoryContentProps = Omit<
  ToolCallMessagePartProps<GetTransactionHistoryInput, GetTransactionHistoryOutput>,
  'args'
> & {
  args: Partial<GetTransactionHistoryInput>
}

const GetTransactionHistoryContent: React.FC<GetTransactionHistoryContentProps> = ({ status, args, result }) => {
  const network = args.network || 'network'

  if (status.type === 'running') {
    return <StatusText.Loading>Fetching transaction history for {network}...</StatusText.Loading>
  }

  if (result && 'code' in result && result.code === 'TOOL_EXECUTION_FAILED') {
    return (
      <StatusText.WithIcon>
        <StatusText.Icon icon={Icon} className="text-red-500" />
        <StatusText.Text>Failed to fetch transaction history</StatusText.Text>
      </StatusText.WithIcon>
    )
  }

  if (result && 'transactions' in result) {
    const txCount = result.transactions.length
    return (
      <StatusText.WithIcon>
        <StatusText.Icon icon={Icon} className="text-green-500" />
        <StatusText.Text>
          Found {txCount} transaction{txCount === 1 ? '' : 's'} on {network}
        </StatusText.Text>
      </StatusText.WithIcon>
    )
  }

  return null
}

export const GetTransactionHistoryUI = makeAssistantToolUI<GetTransactionHistoryInput, GetTransactionHistoryOutput>({
  toolName: 'getTransactionHistoryTool',
  render: GetTransactionHistoryContent,
})
