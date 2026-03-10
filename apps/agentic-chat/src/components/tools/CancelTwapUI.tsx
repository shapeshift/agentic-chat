import type { CancelConditionalOrderConfig } from './useCancelConditionalOrderExecution'

import { CancelConditionalOrderUI } from './CancelConditionalOrderUI'
import type { ToolUIComponentProps } from './toolUIHelpers'

const config: CancelConditionalOrderConfig = {
  toolType: 'cancel_twap',
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
