import type { Clock } from 'lucide-react'
import { ExternalLink, CheckCircle, XCircle, AlertCircle, AlertTriangle, Eye } from 'lucide-react'

import { stopPropagationHandler } from '@/lib/eventHandlers'
import { getExplorerUrl } from '@/lib/explorers'
import { cn } from '@/lib/utils'

import { ToolCard } from '../ui/ToolCard'

import { useToolStateRender } from './toolUIHelpers'
import type { ToolUIComponentProps } from './toolUIHelpers'

type TwapOrderStatus = 'open' | 'fulfilled' | 'cancelled' | 'expired' | 'failed' | 'partiallyFilled'

const STATUS_CONFIG: Record<TwapOrderStatus, { icon: typeof Clock; label: string; className: string }> = {
  open: { icon: Eye, label: 'Active', className: 'text-blue-500' },
  fulfilled: { icon: CheckCircle, label: 'Filled', className: 'text-green-500' },
  cancelled: { icon: XCircle, label: 'Cancelled', className: 'text-red-500' },
  expired: { icon: AlertCircle, label: 'Expired', className: 'text-muted-foreground' },
  failed: { icon: AlertTriangle, label: 'Failed', className: 'text-orange-500' },
  partiallyFilled: { icon: AlertCircle, label: 'Partially Filled', className: 'text-yellow-500' },
}

function isValidStatus(status: string): status is TwapOrderStatus {
  return status in STATUS_CONFIG
}

function OrderStatusBadge({ status }: { status: TwapOrderStatus }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.open
  const Icon = config.icon

  return (
    <div className={cn('flex items-center gap-1 text-xs font-medium', config.className)}>
      <Icon className="h-3 w-3" />
      <span>{config.label}</span>
    </div>
  )
}

interface TwapOrderItemProps {
  id: string
  status: TwapOrderStatus
  network: string
  sellToken: string
  buyToken: string
  sellAmount: string
  validTo: number
  cowTrackingUrl: string
  orderHash?: string
}

function TwapOrderItem({
  status,
  network,
  sellToken,
  buyToken,
  sellAmount,
  validTo,
  cowTrackingUrl,
}: TwapOrderItemProps) {
  const isActive = status === 'open'
  const expiresDate = new Date(validTo * 1000)

  return (
    <div className="flex items-center justify-between py-3 px-1 gap-4">
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium truncate">
            {sellAmount} {sellToken}
          </span>
          <span className="text-muted-foreground">&rarr;</span>
          <span className="font-medium">{buyToken}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="capitalize">{network}</span>
          {isActive && (
            <>
              <span>&bull;</span>
              <span>
                Expires{' '}
                {expiresDate.toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
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

export function GetTwapOrdersUI({ toolPart }: ToolUIComponentProps<'getTwapOrdersTool'>) {
  const { state, output } = toolPart

  const stateRender = useToolStateRender(state, {
    loading: 'Fetching your TWAP/DCA orders...',
    error: 'Failed to fetch TWAP/DCA orders',
  })

  if (stateRender) return stateRender

  const orders = (output?.orders ?? []).map(o => {
    const submitTxHash = o.submitTxHash
    const registryExplorerUrl = submitTxHash ? getExplorerUrl(o.network, submitTxHash) : ''

    return {
      ...o,
      status: isValidStatus(o.status) ? o.status : ('open' as TwapOrderStatus),
      cowTrackingUrl: o.cowTrackingUrl || registryExplorerUrl,
    }
  })

  if (orders.length === 0) {
    return (
      <ToolCard.Root defaultOpen>
        <ToolCard.Header>
          <ToolCard.HeaderRow>
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              <span className="font-medium">TWAP/DCA Orders</span>
            </div>
          </ToolCard.HeaderRow>
        </ToolCard.Header>
        <ToolCard.Content>
          <div className="text-sm text-muted-foreground pb-4">No TWAP/DCA orders found.</div>
        </ToolCard.Content>
      </ToolCard.Root>
    )
  }

  const activeCount = orders.filter(o => o.status === 'open').length

  return (
    <ToolCard.Root defaultOpen>
      <ToolCard.Header>
        <ToolCard.HeaderRow>
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" />
            <span className="font-medium">TWAP/DCA Orders</span>
            {activeCount > 0 && <span className="text-xs text-muted-foreground">({activeCount} active)</span>}
          </div>
          <span className="text-sm text-muted-foreground">{orders.length} total</span>
        </ToolCard.HeaderRow>
      </ToolCard.Header>
      <ToolCard.Content>
        <ToolCard.Details>
          <ToolCard.ItemList
            items={orders}
            renderItem={order => (
              <TwapOrderItem
                key={order.id}
                id={order.id}
                status={order.status}
                network={order.network}
                sellToken={order.sellToken}
                buyToken={order.buyToken}
                sellAmount={order.sellAmount}
                validTo={order.validTo}
                cowTrackingUrl={order.cowTrackingUrl}
                orderHash={order.orderHash}
              />
            )}
          />
        </ToolCard.Details>
      </ToolCard.Content>
    </ToolCard.Root>
  )
}
