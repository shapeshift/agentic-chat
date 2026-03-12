import { CancelConditionalOrderUI } from './CancelConditionalOrderUI'
import type { ToolUIComponentProps } from './toolUIHelpers'
import type { CancelConditionalOrderConfig } from './useCancelConditionalOrderExecution'

const config: CancelConditionalOrderConfig = {
  toolName: 'cancelTwapTool',
  orderLabel: 'TWAP/DCA order',
  renderSuccessToast: () => <span>TWAP/DCA order cancelled successfully</span>,
}

export function CancelTwapUI({ toolPart }: ToolUIComponentProps<'cancelTwapTool'>) {
  return (
    <CancelConditionalOrderUI
      toolCallId={toolPart.toolCallId}
      state={toolPart.state}
      cancelOutput={toolPart.output}
      config={config}
      headerLabel="Cancel TWAP/DCA"
    />
  )
}
