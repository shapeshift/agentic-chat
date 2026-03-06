import { CancelConditionalOrderUI } from './CancelConditionalOrderUI'
import type { ToolUIComponentProps } from './toolUIHelpers'

export function CancelStopLossUI({ toolPart }: ToolUIComponentProps<'cancelStopLossTool'>) {
  return (
    <CancelConditionalOrderUI
      toolCallId={toolPart.toolCallId}
      state={toolPart.state}
      cancelOutput={toolPart.output}
      toolType="cancel_stop_loss"
      orderLabel="Stop-loss order"
      headerLabel="Cancel Stop-Loss"
    />
  )
}
