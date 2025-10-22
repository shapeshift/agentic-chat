import type { DynamicToolUIPart } from 'ai'

import { StatusText } from '../ui/StatusText'

interface GetAccountUIProps {
  toolPart: DynamicToolUIPart
}

export function GetAccountUI({ toolPart }: GetAccountUIProps) {
  const input = toolPart.input as Partial<Record<string, unknown>> | undefined
  const { state } = toolPart

  const accountDetailsText = (() => {
    const parts = ['account details']
    if (input?.account) {
      const account = String(input.account as string)
      parts.push(`for ${account}`)
    }
    if (input?.network) {
      const network = String(input.network as string)
      parts.push(`on ${network}`)
    }
    return parts.join(' ')
  })()

  if (state === 'input-streaming' || state === 'input-available') {
    return <StatusText.Loading>{`Checking ${accountDetailsText}`}</StatusText.Loading>
  }

  if (state === 'output-error') {
    return <StatusText.Error>{`Failed to find ${accountDetailsText} ❌`}</StatusText.Error>
  }

  return <StatusText.Success>{`Found ${accountDetailsText} ✅`}</StatusText.Success>
}
