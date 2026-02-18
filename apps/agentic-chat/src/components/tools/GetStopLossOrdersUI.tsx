import type { CreateStopLossOutput } from '@shapeshiftoss/agentic-server'
import { Clock, ExternalLink, CheckCircle, XCircle, AlertCircle, Eye } from 'lucide-react'
import { useMemo } from 'react'

import { useWalletConnection } from '@/hooks/useWalletConnection'
import { stopPropagationHandler } from '@/lib/eventHandlers'
import { getExplorerUrl } from '@/lib/explorers'
import { orderRegistry } from '@/lib/orderRegistry'
import { cn, truncateAddress } from '@/lib/utils'
import type { PersistedToolState } from '@/stores/chatStore'
import { useChatStore } from '@/stores/chatStore'

import { ToolCard } from '../ui/ToolCard'

import { useToolStateRender } from './toolUIHelpers'
import type { ToolUIComponentProps } from './toolUIHelpers'

type StopLossOrderStatus = 'open' | 'fulfilled' | 'cancelled' | 'expired' | 'presignaturePending' | 'watching'

const STATUS_CONFIG: Record<StopLossOrderStatus, { icon: typeof Clock; label: string; className: string }> = {
  open: { icon: Eye, label: 'Active', className: 'text-blue-500' },
  fulfilled: { icon: CheckCircle, label: 'Filled', className: 'text-green-500' },
  cancelled: { icon: XCircle, label: 'Cancelled', className: 'text-red-500' },
  expired: { icon: AlertCircle, label: 'Expired', className: 'text-muted-foreground' },
  presignaturePending: { icon: Eye, label: 'Pending', className: 'text-yellow-500' },
  watching: { icon: Clock, label: 'Watching', className: 'text-orange-500' },
}

function isValidStatus(status: string): status is StopLossOrderStatus {
  return status in STATUS_CONFIG
}

function OrderStatusBadge({ status }: { status: StopLossOrderStatus }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.open
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
  sellToken: string
  buyToken: string
  sellAmount: string
  validTo: number
  cowTrackingUrl: string
  strikePrice?: string
  orderHash?: string
  walletAddress?: string
}

function StopLossOrderItem({
  status,
  network,
  sellToken,
  buyToken,
  sellAmount,
  validTo,
  cowTrackingUrl,
  strikePrice,
  walletAddress,
}: StopLossOrderItemProps) {
  const isActive = status === 'open' || status === 'presignaturePending'
  const isWatching = status === 'watching'
  const expiresDate = new Date(validTo * 1000)
  const truncatedWallet = walletAddress ? truncateAddress(walletAddress) : undefined

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
          {truncatedWallet && (
            <>
              <span>&bull;</span>
              <span>{truncatedWallet}</span>
            </>
          )}
          {isWatching && strikePrice && (
            <>
              <span>&bull;</span>
              <span>Strike: {strikePrice}</span>
            </>
          )}
          {isWatching && !strikePrice && (
            <>
              <span>&bull;</span>
              <span>Watching for trigger</span>
            </>
          )}
          {isActive && (
            <>
              <span>&bull;</span>
              <span>Expires {expiresDate.toLocaleDateString()}</span>
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

interface DisplayOrder {
  id: string
  status: StopLossOrderStatus
  network: string
  sellToken: string
  buyToken: string
  sellAmount: string
  validTo: number
  cowTrackingUrl: string
  strikePrice?: string
  orderHash?: string
  walletAddress?: string
}

const isStopLossTx = (tx: PersistedToolState): boolean => tx.toolType === 'stop_loss' && Boolean(tx.meta.submitTxHash)

const toDisplayOrder = (tx: PersistedToolState): DisplayOrder => {
  const output = tx.toolOutput as CreateStopLossOutput | undefined
  const network = output?.summary?.network ?? 'unknown'
  const submitTxHash = tx.meta.submitTxHash as string | undefined
  const explorerUrl = submitTxHash ? getExplorerUrl(network, submitTxHash) : ''

  return {
    id: tx.toolCallId,
    status: 'watching' as StopLossOrderStatus,
    network,
    sellToken: output?.summary?.sellAsset?.symbol ?? 'Unknown',
    buyToken: output?.summary?.buyAsset?.symbol ?? 'Unknown',
    sellAmount: output?.summary?.sellAsset?.amount ?? '0',
    validTo: output?.summary?.expiresAt ? Math.floor(new Date(output.summary.expiresAt).getTime() / 1000) : 0,
    cowTrackingUrl: explorerUrl,
    strikePrice: output?.summary?.triggerPrice,
    walletAddress: tx.walletAddress,
  }
}

const selectHistoricalOrders = (transactions: PersistedToolState[]): DisplayOrder[] =>
  transactions.filter(isStopLossTx).map(toDisplayOrder)

function selectRegistryOrders(safeDeploymentState: Record<number, { safeAddress: string }>): DisplayOrder[] {
  const safeAddresses = Object.values(safeDeploymentState)
    .filter(s => s.safeAddress)
    .map(s => s.safeAddress)
  if (safeAddresses.length === 0) return []

  const allOrders = safeAddresses.flatMap(addr => orderRegistry.getActiveOrders(addr))
  return allOrders.map(record => ({
    id: record.orderHash,
    status: 'watching' as StopLossOrderStatus,
    network: record.network,
    sellToken: record.sellToken.symbol,
    buyToken: record.buyToken.symbol,
    sellAmount: record.sellToken.amount,
    validTo: record.validTo,
    cowTrackingUrl: getExplorerUrl(record.network, record.submitTxHash),
    strikePrice: record.strikePrice,
    orderHash: record.orderHash,
  }))
}

export function GetStopLossOrdersUI({ toolPart }: ToolUIComponentProps<'getStopLossOrdersTool'>) {
  const { state, output } = toolPart
  const input = toolPart.input as { accountScope?: string } | undefined
  const isHistoryMode = input?.accountScope === 'history'
  const { evmAddress, safeDeploymentState } = useWalletConnection()
  const persistedTransactions = useChatStore(state => state.persistedTransactions)
  const historicalOrders = useMemo(() => selectHistoricalOrders(persistedTransactions), [persistedTransactions])

  const stateRender = useToolStateRender(state, {
    loading: isHistoryMode ? 'Loading order history...' : 'Fetching your stop-loss orders...',
    error: 'Failed to fetch stop-loss orders',
  })

  if (stateRender) return stateRender

  const orders: DisplayOrder[] = isHistoryMode
    ? historicalOrders
    : (() => {
        // Server orders from CoW API and registry-based watching orders
        const serverOrders: DisplayOrder[] = (output?.orders ?? []).map(o => {
          const watchingExplorerUrl =
            o.status === 'watching' && o.submitTxHash ? getExplorerUrl(o.network, o.submitTxHash) : ''

          return {
            ...o,
            status: isValidStatus(o.status) ? o.status : 'open',
            cowTrackingUrl: o.cowTrackingUrl || watchingExplorerUrl,
          }
        })

        if (!evmAddress) return serverOrders

        // Supplement with local registry orders not already in server results
        const registryOrders = selectRegistryOrders(safeDeploymentState)
        const serverOrderKeys = new Set(
          serverOrders.map(o => `${o.network}|${o.sellToken}|${o.buyToken}|${o.sellAmount}`)
        )
        const uniqueRegistryOrders = registryOrders.filter(
          o => !serverOrderKeys.has(`${o.network}|${o.sellToken}|${o.buyToken}|${o.sellAmount}`)
        )

        const merged = [...uniqueRegistryOrders, ...serverOrders]
        merged.sort((a, b) => {
          if (a.status === 'watching' && b.status !== 'watching') return -1
          if (a.status !== 'watching' && b.status === 'watching') return 1
          return b.validTo - a.validTo
        })

        return merged
      })()

  if (orders.length === 0) {
    return (
      <ToolCard.Root defaultOpen>
        <ToolCard.Header>
          <ToolCard.HeaderRow>
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              <span className="font-medium">Stop-Loss Orders</span>
              {isHistoryMode && <span className="text-xs text-muted-foreground">(History)</span>}
            </div>
          </ToolCard.HeaderRow>
        </ToolCard.Header>
        <ToolCard.Content>
          <div className="text-sm text-muted-foreground pb-4">No stop-loss orders found.</div>
        </ToolCard.Content>
      </ToolCard.Root>
    )
  }

  const activeCount = orders.filter(
    o => o.status === 'open' || o.status === 'presignaturePending' || o.status === 'watching'
  ).length

  return (
    <ToolCard.Root defaultOpen>
      <ToolCard.Header>
        <ToolCard.HeaderRow>
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" />
            <span className="font-medium">Stop-Loss Orders</span>
            {isHistoryMode && <span className="text-xs text-muted-foreground">(History)</span>}
            {!isHistoryMode && activeCount > 0 && (
              <span className="text-xs text-muted-foreground">({activeCount} active)</span>
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
                status={isValidStatus(order.status) ? order.status : 'open'}
                network={order.network}
                sellToken={order.sellToken}
                buyToken={order.buyToken}
                sellAmount={order.sellAmount}
                validTo={order.validTo}
                cowTrackingUrl={order.cowTrackingUrl}
                strikePrice={order.strikePrice}
                orderHash={order.orderHash}
                walletAddress={isHistoryMode ? order.walletAddress : undefined}
              />
            ))}
          </div>
        </ToolCard.Details>
      </ToolCard.Content>
    </ToolCard.Root>
  )
}
