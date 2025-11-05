import type { GetTransactionHistoryOutput, ParsedTransaction } from '@shapeshiftoss/agentic-server'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CheckCircle2, FileCode, XCircle } from 'lucide-react'
import type React from 'react'

import { ToolCard } from '../ui/ToolCard'

import { useToolStateRender } from './toolUIHelpers'
import type { ToolUIComponentProps } from './toolUIHelpers'

function truncateAddress(address: string, startChars = 6, endChars = 4): string {
  if (address.length <= startChars + endChars) return address
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatShortTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 30) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

type TransactionIconProps = {
  type: ParsedTransaction['type']
  className?: string
}

function TransactionIcon({ type, className = 'w-5 h-5' }: TransactionIconProps): React.ReactElement {
  const iconClass = className

  switch (type) {
    case 'send':
      return <ArrowUpRight className={`${iconClass} text-orange-500`} />
    case 'receive':
      return <ArrowDownLeft className={`${iconClass} text-green-500`} />
    case 'swap':
      return <ArrowLeftRight className={`${iconClass} text-blue-500`} />
    case 'contract':
      return <FileCode className={`${iconClass} text-purple-500`} />
  }
}

function getTransactionTypeLabel(type: ParsedTransaction['type']): string {
  switch (type) {
    case 'send':
      return 'Sent'
    case 'receive':
      return 'Received'
    case 'swap':
      return 'Swap'
    case 'contract':
      return 'Contract'
  }
}

function getSwapDisplay(tx: ParsedTransaction): string | null {
  if (tx.type !== 'swap' || !tx.tokenTransfers || tx.tokenTransfers.length < 2) return null

  const [tokenOut, tokenIn] = tx.tokenTransfers
  if (!tokenOut || !tokenIn) return null

  const outAmount = parseFloat(tokenOut.amount)
  const inAmount = parseFloat(tokenIn.amount)

  const formatAmount = (amount: number): string => {
    if (amount === 0) return '0'
    if (amount < 0.000001) return amount.toExponential(2)
    if (amount < 1) return amount.toFixed(6)
    if (amount < 1000) return amount.toFixed(4)
    return amount.toLocaleString('en-US', { maximumFractionDigits: 2 })
  }

  return `${formatAmount(outAmount)} ${tokenOut.symbol} → ${formatAmount(inAmount)} ${tokenIn.symbol}`
}

function getPrimaryAmount(tx: ParsedTransaction): string {
  if (tx.type === 'swap') {
    const swapDisplay = getSwapDisplay(tx)
    if (swapDisplay) return swapDisplay
  }

  const value = parseFloat(tx.value)
  if (value === 0 && tx.tokenTransfers && tx.tokenTransfers.length > 0) {
    const transfer = tx.tokenTransfers[0]
    if (!transfer) return 'N/A'
    const amount = parseFloat(transfer.amount)
    const prefix = tx.type === 'send' ? '-' : tx.type === 'receive' ? '+' : ''
    return `${prefix}${amount.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${transfer.symbol}`
  }

  if (value === 0) return 'N/A'

  const prefix = tx.type === 'send' ? '-' : tx.type === 'receive' ? '+' : ''
  return `${prefix}${value} ETH`
}

function TransactionCard({ tx, network }: { tx: ParsedTransaction; network: string }) {
  const typeLabel = getTransactionTypeLabel(tx.type)
  const primaryAmount = getPrimaryAmount(tx)
  const isSwap = tx.type === 'swap'
  const isSuccess = tx.status === 'success'

  const amountColorClass =
    tx.type === 'receive' ? 'text-green-500' : tx.type === 'send' ? 'text-orange-500' : 'text-foreground'

  return (
    <ToolCard.Root defaultOpen={false}>
      <ToolCard.Header>
        <ToolCard.HeaderRow>
          <div className="flex items-start justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <TransactionIcon type={tx.type} />
              </div>
              <div className="flex flex-col justify-center">
                <span className="text-[16px] font-medium leading-6">{typeLabel}</span>
                <span className="text-sm text-muted-foreground font-normal leading-5">
                  {formatShortTimestamp(tx.timestamp)}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end justify-center">
              <span className={`text-[16px] font-bold leading-6 ${amountColorClass}`}>{primaryAmount}</span>
            </div>
          </div>
        </ToolCard.HeaderRow>
      </ToolCard.Header>

      <ToolCard.Content>
        <ToolCard.Details>
          <div className="space-y-3">
            <ToolCard.DetailItem
              label="TX ID"
              value={
                <span className="font-mono text-xs" title={tx.txid}>
                  {truncateAddress(tx.txid, 8, 6)}
                </span>
              }
            />
            <ToolCard.DetailItem
              label="Status"
              value={
                <div className="flex items-center gap-1">
                  {isSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="text-green-500">Confirmed</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-red-500" />
                      <span className="text-red-500">Failed</span>
                    </>
                  )}
                </div>
              }
            />
            <ToolCard.DetailItem label="Miner Fee" value={`${tx.fee} ${network === 'solana' ? 'SOL' : 'ETH'}`} />
            <ToolCard.DetailItem label="Date" value={formatTimestamp(tx.timestamp)} />
            {!isSwap && (
              <>
                <ToolCard.DetailItem label="From" value={truncateAddress(tx.from)} />
                <ToolCard.DetailItem label="To" value={truncateAddress(tx.to)} />
              </>
            )}
          </div>
        </ToolCard.Details>
      </ToolCard.Content>
    </ToolCard.Root>
  )
}

export function GetTransactionHistoryUI({ toolPart }: ToolUIComponentProps) {
  const input = toolPart.input as Partial<Record<string, unknown>> | undefined
  const output = toolPart.output as GetTransactionHistoryOutput | undefined
  const { state } = toolPart

  const networkValue = input?.network
  const network = networkValue !== undefined ? String(networkValue as string) : 'network'

  const stateRender = useToolStateRender(state, {
    loading: `Fetching transaction history for ${network}`,
    error: `Failed to fetch transaction history ❌`,
  })

  if (stateRender) return stateRender

  if (state === 'output-error') {
    return null
  }

  if (state === 'output-available' && output && 'transactions' in output) {
    const transactions = output.transactions

    if (transactions.length === 0) {
      return null
    }

    return (
      <div className="space-y-3">
        {transactions.map(tx => (
          <TransactionCard key={tx.txid} tx={tx} network={network} />
        ))}
      </div>
    )
  }

  return null
}
