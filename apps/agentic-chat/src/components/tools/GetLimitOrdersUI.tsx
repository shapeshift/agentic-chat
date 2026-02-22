import BigNumber from 'bignumber.js'
import { Clock, ExternalLink, Timer, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { useMemo } from 'react'

import { stopPropagationHandler } from '@/lib/eventHandlers'
import { cn } from '@/lib/utils'

import { Amount } from '../ui/Amount'
import { ToolCard } from '../ui/ToolCard'

import { useToolStateRender } from './toolUIHelpers'
import type { ToolUIComponentProps } from './toolUIHelpers'

type OrderStatus = 'open' | 'fulfilled' | 'cancelled' | 'expired'

const STATUS_CONFIG: Record<OrderStatus, { icon: typeof Clock; label: string; className: string }> = {
  open: { icon: Clock, label: 'Open', className: 'text-blue-500' },
  fulfilled: { icon: CheckCircle, label: 'Filled', className: 'text-green-500' },
  cancelled: { icon: XCircle, label: 'Cancelled', className: 'text-red-500' },
  expired: { icon: AlertCircle, label: 'Expired', className: 'text-muted-foreground' },
}

function isValidOrderStatus(status: string): status is OrderStatus {
  return status in STATUS_CONFIG
}

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.open
  const Icon = config.icon

  return (
    <div className={cn('flex items-center gap-1 text-xs font-medium', config.className)}>
      <Icon className="h-3 w-3" />
      <span>{config.label}</span>
    </div>
  )
}

interface OrderListItemProps {
  status?: OrderStatus
  network: string
  sellTokenSymbol: string
  buyTokenSymbol: string
  sellAmount: string
  buyAmount: string
  filledPercent: number
  expiresAt: string
  trackingUrl: string
}

function OrderListItem({
  status,
  network,
  sellTokenSymbol,
  buyTokenSymbol,
  sellAmount,
  buyAmount,
  filledPercent,
  expiresAt,
  trackingUrl,
}: OrderListItemProps) {
  const isFilled = status === 'fulfilled'
  const isOpen = status === 'open'

  const rate = useMemo(() => {
    const sellBn = new BigNumber(sellAmount)
    const buyBn = new BigNumber(buyAmount)
    return sellBn.gt(0)
      ? buyBn
          .div(sellBn)
          .toFixed(6)
          .replace(/\.?0+$/, '')
      : '0'
  }, [sellAmount, buyAmount])

  return (
    <div className="flex items-center justify-between py-3 px-1 gap-4">
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          <span>
            Sell <Amount.Crypto value={sellAmount} symbol={sellTokenSymbol} className="font-medium" />
          </span>
          <span className="text-muted-foreground">|</span>
          <span>
            Buy <Amount.Crypto value={buyAmount} symbol={buyTokenSymbol} className="font-medium" />
          </span>
          <span className="text-muted-foreground">|</span>
          <span className="text-muted-foreground">
            Rate: {rate} {buyTokenSymbol}/{sellTokenSymbol}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="capitalize">{network}</span>
          {isOpen && (
            <>
              <span>•</span>
              <span>Expires {new Date(expiresAt).toLocaleDateString()}</span>
            </>
          )}
          {isFilled && filledPercent > 0 && (
            <>
              <span>•</span>
              <span>{filledPercent}% filled</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {status && <OrderStatusBadge status={status} />}
        <a
          href={trackingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-primary transition-colors"
          onClick={stopPropagationHandler}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  )
}

export function GetLimitOrdersUI({ toolPart }: ToolUIComponentProps<'getLimitOrdersTool'>) {
  const { state, output } = toolPart

  const stateRender = useToolStateRender(state, {
    loading: 'Fetching your limit orders...',
    error: 'Failed to fetch limit orders',
  })

  if (stateRender) return stateRender

  const orders = (output?.orders ?? []).map(o => ({
    ...o,
    status: isValidOrderStatus(o.status) ? o.status : ('open' as OrderStatus),
  }))

  if (orders.length === 0) {
    return (
      <ToolCard.Root defaultOpen>
        <ToolCard.Header>
          <ToolCard.HeaderRow>
            <div className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-primary" />
              <span className="font-medium">Limit Orders</span>
            </div>
          </ToolCard.HeaderRow>
        </ToolCard.Header>
        <ToolCard.Content>
          <div className="text-sm text-muted-foreground pb-4">No limit orders found.</div>
        </ToolCard.Content>
      </ToolCard.Root>
    )
  }

  const openCount = orders.filter(o => o.status === 'open').length

  return (
    <ToolCard.Root defaultOpen>
      <ToolCard.Header>
        <ToolCard.HeaderRow>
          <div className="flex items-center gap-2">
            <Timer className="w-5 h-5 text-primary" />
            <span className="font-medium">Limit Orders</span>
            <span className="text-xs text-muted-foreground">({openCount} open)</span>
          </div>
          <span className="text-sm text-muted-foreground">{orders.length} total</span>
        </ToolCard.HeaderRow>
      </ToolCard.Header>
      <ToolCard.Content>
        <ToolCard.Details>
          <ToolCard.ItemList
            items={orders}
            renderItem={order => (
              <OrderListItem
                key={order.orderId}
                status={order.status}
                network={order.network}
                sellTokenSymbol={order.sellTokenSymbol}
                buyTokenSymbol={order.buyTokenSymbol}
                sellAmount={order.sellAmount}
                buyAmount={order.buyAmount}
                filledPercent={order.filledPercent}
                expiresAt={order.expiresAt}
                trackingUrl={order.trackingUrl}
              />
            )}
          />
        </ToolCard.Details>
      </ToolCard.Content>
    </ToolCard.Root>
  )
}
