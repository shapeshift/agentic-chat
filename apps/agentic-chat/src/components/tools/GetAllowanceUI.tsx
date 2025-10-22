import type { DynamicToolUIPart } from 'ai'
import { AlertCircle, CheckCircle } from 'lucide-react'

import { CollapsableDetails } from '../ui/CollapsableDetails'
import { StatusText } from '../ui/StatusText'

interface GetAllowanceUIProps {
  toolPart: DynamicToolUIPart
}

export function GetAllowanceUI({ toolPart }: GetAllowanceUIProps) {
  const input = toolPart.input as Partial<Record<string, unknown>> | undefined
  const output = toolPart.output
  const { state, toolName } = toolPart

  if (state === 'input-streaming' || state === 'input-available') {
    const asset = input?.asset as Record<string, unknown> | undefined
    const message = asset ? `Fetching allowance for ${asset.symbol ?? ''}...` : 'Fetching allowance'
    return <StatusText.Loading>{message}</StatusText.Loading>
  }

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
