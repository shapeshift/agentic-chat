import { CancelConditionalOrderUI } from './CancelConditionalOrderUI'
import type { ToolUIComponentProps } from './toolUIHelpers'

export function CancelTwapUI({ toolPart }: ToolUIComponentProps<'cancelTwapTool'>) {
  return (
    <CancelConditionalOrderUI
      toolCallId={toolPart.toolCallId}
      state={toolPart.state}
      cancelOutput={toolPart.output}
      toolType="cancel_twap"
      orderLabel="TWAP/DCA order"
      headerLabel="Cancel TWAP/DCA"
    />
  )
}
