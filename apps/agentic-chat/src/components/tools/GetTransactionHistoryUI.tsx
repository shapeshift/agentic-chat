import { History } from 'lucide-react'

import { StatusText } from '../ui/StatusText'

import { useToolStateRender } from './toolUIHelpers'
import type { ToolUIComponentProps } from './toolUIHelpers'

const Icon = History

export function GetTransactionHistoryUI({ toolPart }: ToolUIComponentProps) {
  const input = toolPart.input as Partial<Record<string, unknown>> | undefined
  const output = toolPart.output as Record<string, unknown> | undefined
  const { state } = toolPart

  const networkValue = input?.network
  const network = networkValue !== undefined ? String(networkValue as string) : 'network'

  const stateRender = useToolStateRender(state, {
    loading: `Fetching transaction history for ${network}...`,
    error: null,
  })

  if (stateRender) return stateRender

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
