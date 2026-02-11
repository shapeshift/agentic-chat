import type { CancelStopLossOutput } from '@shapeshiftoss/agentic-server'
import { ExternalLink, XCircle, CheckCircle } from 'lucide-react'

import { ToolCard } from '../ui/ToolCard'

import { useToolStateRender } from './toolUIHelpers'
import type { ToolUIComponentProps } from './toolUIHelpers'

export function CancelStopLossUI({ toolPart }: ToolUIComponentProps) {
  const { state, output } = toolPart

  const stateRender = useToolStateRender(state, {
    loading: 'Cancelling stop-loss order...',
    error: 'Failed to cancel stop-loss order',
  })

  if (stateRender) return stateRender

  const data = output as CancelStopLossOutput | undefined
  if (!data) return null

  const isSuccess = data.success
  const Icon = isSuccess ? CheckCircle : XCircle
  const iconColor = isSuccess ? 'text-green-500' : 'text-yellow-500'

  return (
    <ToolCard.Root defaultOpen>
      <ToolCard.Header>
        <ToolCard.HeaderRow>
          <div className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${iconColor}`} />
            <span className="font-medium">{isSuccess ? 'Stop-Loss Cancelled' : 'Cancellation Note'}</span>
          </div>
        </ToolCard.HeaderRow>
      </ToolCard.Header>
      <ToolCard.Content>
        <ToolCard.Details>
          <div className="text-sm text-muted-foreground pb-2">{data.message}</div>
          {data.cowOrderId && data.cowTrackingUrl && (
            <a
              href={data.cowTrackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View CoW order
            </a>
          )}
        </ToolCard.Details>
      </ToolCard.Content>
    </ToolCard.Root>
  )
}
