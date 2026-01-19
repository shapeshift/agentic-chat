import type { CreateLimitOrderOutput, GetLimitOrdersOutput } from '@shapeshiftoss/agentic-server'
import type { PersistedToolState } from '@shapeshiftoss/chat'
import { useChatStore } from '@shapeshiftoss/chat'
import BigNumber from 'bignumber.js'
import { Clock, ExternalLink, Timer, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { useMemo } from 'react'

import { stopPropagationHandler } from '@/lib/eventHandlers'
import { cn, truncateAddress } from '@/lib/utils'

import { Amount } from '../ui/Amount'
import { ToolCard } from '../ui/ToolCard'

import { useToolStateRender } from './toolUIHelpers'
import type { ToolUIComponentProps } from './toolUIHelpers'

type OrderStatus = 'open' | 'fulfilled' | 'cancelled' | 'expired' | 'presignaturePending'

const STATUS_CONFIG: Record<OrderStatus, { icon: typeof Clock; label: string; className: string }> = {
  open: { icon: Clock, label: 'Open', className: 'text-blue-500' },
  fulfilled: { icon: CheckCircle, label: 'Filled', className: 'text-green-500' },
  cancelled: { icon: XCircle, label: 'Cancelled', className: 'text-red-500' },
  expired: { icon: AlertCircle, label: 'Expired', className: 'text-muted-foreground' },
  presignaturePending: { icon: Clock, label: 'Pending', className: 'text-yellow-500' },
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
  walletAddress?: string
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
  walletAddress,
}: OrderListItemProps) {
  const isFilled = status === 'fulfilled'
  const isOpen = status === 'open' || status === 'presignaturePending'

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

  const truncatedWallet = walletAddress ? truncateAddress(walletAddress) : undefined

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
          {truncatedWallet && (
            <>
              <span>•</span>
              <span>{truncatedWallet}</span>
            </>
          )}
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

interface DisplayOrder {
  orderId: string
  status?: OrderStatus
  network: string
  sellTokenSymbol: string
  buyTokenSymbol: string
  sellAmount: string
  buyAmount: string
  filledPercent: number
  expiresAt: string
  trackingUrl: string
  walletAddress?: string
}

const isLimitOrderTx = (tx: PersistedToolState): boolean => tx.toolType === 'limit_order' && Boolean(tx.meta.orderId)

const toDisplayOrder = (tx: PersistedToolState): DisplayOrder => {
  const output = tx.toolOutput as CreateLimitOrderOutput | undefined
  const orderId = tx.meta.orderId as string
  return {
    orderId,
    network: output?.summary?.network ?? 'unknown',
    sellTokenSymbol: output?.summary?.sellAsset?.symbol ?? 'Unknown',
    buyTokenSymbol: output?.summary?.buyAsset?.symbol ?? 'Unknown',
    sellAmount: output?.summary?.sellAsset?.amount ?? '0',
    buyAmount: output?.summary?.buyAsset?.estimatedAmount ?? '0',
    filledPercent: 0,
    expiresAt: output?.summary?.expiresAt ?? new Date().toISOString(),
    trackingUrl: `https://explorer.cow.fi/orders/${orderId}`,
    walletAddress: tx.walletAddress,
  }
}

const selectHistoricalOrders = (transactions: PersistedToolState[]): DisplayOrder[] =>
  transactions.filter(isLimitOrderTx).map(toDisplayOrder)

export function GetLimitOrdersUI({ toolPart }: ToolUIComponentProps) {
  const { state, output } = toolPart
  const input = toolPart.input as { accountScope?: string } | undefined
  const isHistoryMode = input?.accountScope === 'history'
  const persistedTransactions = useChatStore(state => state.persistedTransactions)
  const historicalOrders = useMemo(() => selectHistoricalOrders(persistedTransactions), [persistedTransactions])

  const stateRender = useToolStateRender(state, {
    loading: isHistoryMode ? 'Loading order history...' : 'Fetching your limit orders...',
    error: 'Failed to fetch limit orders',
  })

  if (stateRender) return stateRender

  const serverData = output as GetLimitOrdersOutput | undefined
  const orders: DisplayOrder[] = isHistoryMode
    ? historicalOrders
    : (serverData?.orders ?? []).map(o => ({
        ...o,
        status: isValidOrderStatus(o.status) ? o.status : 'open',
      }))

  if (orders.length === 0) {
    return (
      <ToolCard.Root defaultOpen>
        <ToolCard.Header>
          <ToolCard.HeaderRow>
            <div className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-primary" />
              <span className="font-medium">Limit Orders</span>
              {isHistoryMode && <span className="text-xs text-muted-foreground">(History)</span>}
            </div>
          </ToolCard.HeaderRow>
        </ToolCard.Header>
        <ToolCard.Content>
          <div className="text-sm text-muted-foreground pb-4">No limit orders found.</div>
        </ToolCard.Content>
      </ToolCard.Root>
    )
  }

  const openCount = orders.filter(o => o.status === 'open' || o.status === 'presignaturePending').length

  return (
    <ToolCard.Root defaultOpen>
      <ToolCard.Header>
        <ToolCard.HeaderRow>
          <div className="flex items-center gap-2">
            <Timer className="w-5 h-5 text-primary" />
            <span className="font-medium">Limit Orders</span>
            {isHistoryMode && <span className="text-xs text-muted-foreground">(History)</span>}
            {!isHistoryMode && <span className="text-xs text-muted-foreground">({openCount} open)</span>}
          </div>
          <span className="text-sm text-muted-foreground">{orders.length} total</span>
        </ToolCard.HeaderRow>
      </ToolCard.Header>
      <ToolCard.Content>
        <ToolCard.Details>
          <div className="divide-y divide-border">
            {orders.map(order => (
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
                walletAddress={isHistoryMode ? order.walletAddress : undefined}
              />
            ))}
          </div>
        </ToolCard.Details>
      </ToolCard.Content>
    </ToolCard.Root>
  )
}
