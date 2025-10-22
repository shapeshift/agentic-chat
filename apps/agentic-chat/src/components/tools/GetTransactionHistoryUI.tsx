import type { DynamicToolUIPart } from 'ai'
import { History } from 'lucide-react'

import { StatusText } from '../ui/StatusText'

const Icon = History

interface GetTransactionHistoryUIProps {
  toolPart: DynamicToolUIPart
}

export function GetTransactionHistoryUI({ toolPart }: GetTransactionHistoryUIProps) {
  const input = toolPart.input as Partial<Record<string, unknown>> | undefined
  const output = toolPart.output as Record<string, unknown> | undefined
  const { state } = toolPart

  const network = String(input?.network ?? 'network')

  if (state === 'input-streaming' || state === 'input-available') {
    return <StatusText.Loading>Fetching transaction history for {network}...</StatusText.Loading>
  }

  if (state === 'output-error') {
    return (
      <StatusText.WithIcon>
        <StatusText.Icon icon={Icon} className="text-red-500" />
        <StatusText.Text>Failed to fetch transaction history</StatusText.Text>
      </StatusText.WithIcon>
    )
  }

  if (state === 'output-available' && output && 'transactions' in output) {
    const txCount = Array.isArray(output.transactions) ? output.transactions.length : 0
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
