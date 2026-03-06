import { useToolStateRender } from './toolUIHelpers'
import type { ToolUIComponentProps } from './toolUIHelpers'

export function GetAccountUI({ toolPart }: ToolUIComponentProps<'lookupExternalAddress'>) {
  const input = toolPart.input as Partial<Record<string, unknown>> | undefined
  const { state } = toolPart

  const accountDetailsText = (() => {
    const parts = ['external address']
    const address = input?.address ?? input?.account
    if (typeof address === 'string') {
      parts.push(address)
    }
    if (typeof input?.network === 'string') {
      parts.push(`on ${input.network}`)
    }
    return parts.join(' ')
  })()

  const stateRender = useToolStateRender(state, {
    loading: `Looking up ${accountDetailsText}`,
    error: `Failed to look up ${accountDetailsText} ❌`,
    success: `Found ${accountDetailsText} ✅`,
  })

  if (stateRender) return stateRender

  return null
}
