import type { GetStopLossOrdersOutput } from '@shapeshiftoss/agentic-server'
import type { Clock } from 'lucide-react'
import { ExternalLink, CheckCircle, XCircle, AlertCircle, AlertTriangle, Eye, Loader } from 'lucide-react'

import { stopPropagationHandler } from '@/lib/eventHandlers'
import { cn } from '@/lib/utils'

import { Amount } from '../ui/Amount'
import { ToolCard } from '../ui/ToolCard'

import { useToolStateRender } from './toolUIHelpers'
import type { ToolUIComponentProps } from './toolUIHelpers'

type StopLossOrderStatus = 'pending' | 'triggered' | 'submitted' | 'filled' | 'cancelled' | 'failed' | 'expired'

const STATUS_CONFIG: Record<StopLossOrderStatus, { icon: typeof Clock; label: string; className: string }> = {
  pending: { icon: Eye, label: 'Monitoring', className: 'text-blue-500' },
  triggered: { icon: AlertTriangle, label: 'Triggered', className: 'text-yellow-500' },
  submitted: { icon: Loader, label: 'Submitted', className: 'text-orange-500' },
  filled: { icon: CheckCircle, label: 'Filled', className: 'text-green-500' },
  cancelled: { icon: XCircle, label: 'Cancelled', className: 'text-red-500' },
  failed: { icon: AlertCircle, label: 'Failed', className: 'text-red-500' },
  expired: { icon: AlertCircle, label: 'Expired', className: 'text-muted-foreground' },
}

function isValidStatus(status: string): status is StopLossOrderStatus {
  return status in STATUS_CONFIG
}

function OrderStatusBadge({ status }: { status: StopLossOrderStatus }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  const Icon = config.icon

  return (
    <div className={cn('flex items-center gap-1 text-xs font-medium', config.className)}>
      <Icon className="h-3 w-3" />
      <span>{config.label}</span>
    </div>
  )
}

interface StopLossOrderItemProps {
  id: string
  status: StopLossOrderStatus
  network: string
  sellTokenSymbol: string
  buyTokenSymbol: string
  sellAmount: string
  triggerPrice: string
  expiresAt: string
  cowTrackingUrl: string | null
  errorMessage: string | null
}

function StopLossOrderItem({
  status,
  network,
  sellTokenSymbol,
  buyTokenSymbol,
  sellAmount,
  triggerPrice,
  expiresAt,
  cowTrackingUrl,
  errorMessage,
}: StopLossOrderItemProps) {
  const isActive = status === 'pending'

  return (
    <div className="flex items-center justify-between py-3 px-1 gap-4">
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          <span>
            Sell <Amount.Crypto value={sellAmount} symbol={sellTokenSymbol} className="font-medium" />
          </span>
          <span className="text-muted-foreground">→</span>
          <span className="font-medium">{buyTokenSymbol}</span>
          <span className="text-muted-foreground">|</span>
          <span className="text-muted-foreground">Trigger: ${triggerPrice}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="capitalize">{network}</span>
          {isActive && (
            <>
              <span>•</span>
              <span>Expires {new Date(expiresAt).toLocaleDateString()}</span>
            </>
          )}
          {errorMessage && (
            <>
              <span>•</span>
              <span className="text-red-500 truncate max-w-[200px]">{errorMessage}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <OrderStatusBadge status={status} />
        {cowTrackingUrl && (
          <a
            href={cowTrackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary transition-colors"
            onClick={stopPropagationHandler}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  )
}

export function GetStopLossOrdersUI({ toolPart }: ToolUIComponentProps) {
  const { state, output } = toolPart

  const stateRender = useToolStateRender(state, {
    loading: 'Fetching your stop-loss orders...',
    error: 'Failed to fetch stop-loss orders',
  })

  if (stateRender) return stateRender

  const data = output as GetStopLossOrdersOutput | undefined
  const orders = data?.orders ?? []

  if (orders.length === 0) {
    return (
      <ToolCard.Root defaultOpen>
        <ToolCard.Header>
          <ToolCard.HeaderRow>
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              <span className="font-medium">Stop-Loss Orders</span>
            </div>
          </ToolCard.HeaderRow>
        </ToolCard.Header>
        <ToolCard.Content>
          <div className="text-sm text-muted-foreground pb-4">No stop-loss orders found.</div>
        </ToolCard.Content>
      </ToolCard.Root>
    )
  }

  const monitoringCount = orders.filter(o => o.status === 'pending').length

  return (
    <ToolCard.Root defaultOpen>
      <ToolCard.Header>
        <ToolCard.HeaderRow>
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" />
            <span className="font-medium">Stop-Loss Orders</span>
            {monitoringCount > 0 && (
              <span className="text-xs text-muted-foreground">({monitoringCount} monitoring)</span>
            )}
          </div>
          <span className="text-sm text-muted-foreground">{orders.length} total</span>
        </ToolCard.HeaderRow>
      </ToolCard.Header>
      <ToolCard.Content>
        <ToolCard.Details>
          <div className="divide-y divide-border">
            {orders.map(order => (
              <StopLossOrderItem
                key={order.id}
                id={order.id}
                status={isValidStatus(order.status) ? order.status : 'pending'}
                network={order.network}
                sellTokenSymbol={order.sellTokenSymbol}
                buyTokenSymbol={order.buyTokenSymbol}
                sellAmount={order.sellAmount}
                triggerPrice={order.triggerPrice}
                expiresAt={order.expiresAt}
                cowTrackingUrl={order.cowTrackingUrl}
                errorMessage={order.errorMessage}
              />
            ))}
          </div>
        </ToolCard.Details>
      </ToolCard.Content>
    </ToolCard.Root>
  )
}
