import type { CancelConditionalOrderConfig } from './useCancelConditionalOrderExecution'

import { CancelConditionalOrderUI } from './CancelConditionalOrderUI'
import type { ToolUIComponentProps } from './toolUIHelpers'

const config: CancelConditionalOrderConfig = {
  toolType: 'cancel_stop_loss',
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
