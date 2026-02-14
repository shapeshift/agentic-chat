import { AlertCircle, CheckCircle } from 'lucide-react'

import { CollapsableDetails } from '../ui/CollapsableDetails'

import { useToolStateRender } from './toolUIHelpers'
import type { ToolUIComponentProps } from './toolUIHelpers'

export function GetAllowanceUI({ toolPart }: ToolUIComponentProps<'getAllowanceTool'>) {
  const input = toolPart.input as Partial<Record<string, unknown>> | undefined
  const output = toolPart.output
  const { state, toolName } = toolPart

  const asset = input?.asset as Record<string, unknown> | undefined
  const symbol = asset ? String((asset.symbol as string) ?? '') : ''
  const message = symbol ? `Fetching allowance for ${symbol}...` : 'Fetching allowance'

  const stateRender = useToolStateRender(state, {
    loading: message,
    error: null,
  })

  if (stateRender) return stateRender

  if (state === 'output-error' || !output) {
    return (
      <CollapsableDetails
        title={`An Error Occurred with ${toolName}`}
        leftIcon={<AlertCircle className="w-4 h-4 text-red-500" />}
      >
        <pre>Failed to get allowance</pre>
      </CollapsableDetails>
    )
  }

  return (
    <CollapsableDetails title="Token allowance" leftIcon={<CheckCircle className="w-4 h-4 text-primary" />}>
      <pre>{JSON.stringify(output)}</pre>
    </CollapsableDetails>
  )
}
