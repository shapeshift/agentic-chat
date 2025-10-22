import type { DynamicToolUIPart } from 'ai'

import { StatusText } from '../ui/StatusText'

interface GetAssetsUIProps {
  toolPart: DynamicToolUIPart
}

export function GetAssetsUI({ toolPart }: GetAssetsUIProps) {
  const input = toolPart.input as Partial<Record<string, unknown>> | undefined
  const { state } = toolPart

  const assetDetailsText = (() => {
    const parts = ['asset details']
    if (input?.searchTerm !== undefined) parts.push(`for ${input.searchTerm}`)
    if (input?.network !== undefined) parts.push(`on ${input.network}`)
    return parts.join(' ')
  })()

  if (state === 'input-streaming' || state === 'input-available') {
    return <StatusText.Loading>Fetching {assetDetailsText}</StatusText.Loading>
  }

  if (state === 'output-error') {
    return <StatusText.Error>Failed to fetch {assetDetailsText} ❌</StatusText.Error>
  }

  return <StatusText.Success>Fetched {assetDetailsText} ✅</StatusText.Success>
}
