import { CancelConditionalOrderUI } from './CancelConditionalOrderUI'
import type { ToolUIComponentProps } from './toolUIHelpers'
import type { CancelConditionalOrderConfig } from './useCancelConditionalOrderExecution'

const config: CancelConditionalOrderConfig = {
  toolName: 'cancelStopLossTool',
  orderLabel: 'Stop-loss order',
  renderSuccessToast: () => <span>Stop-loss order cancelled successfully</span>,
}

export function CancelStopLossUI({ toolPart }: ToolUIComponentProps<'cancelStopLossTool'>) {
  return (
    <CancelConditionalOrderUI
      toolCallId={toolPart.toolCallId}
      state={toolPart.state}
      cancelOutput={toolPart.output}
      config={config}
      headerLabel="Cancel Stop-Loss"
    />
  )
}
