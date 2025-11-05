import { useToolStateRender } from './toolUIHelpers'
import type { ToolUIComponentProps } from './toolUIHelpers'

export function GetAccountUI({ toolPart }: ToolUIComponentProps) {
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

  const stateRender = useToolStateRender(state, {
    loading: `Checking ${accountDetailsText}`,
    error: `Failed to find ${accountDetailsText} ❌`,
    success: `Found ${accountDetailsText} ✅`,
  })

  if (stateRender) return stateRender

  return null
}
