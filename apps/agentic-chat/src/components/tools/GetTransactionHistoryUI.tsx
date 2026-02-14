import type { ParsedTransaction, Network } from '@shapeshiftoss/types'
import { networkToChainIdMap, networkToNativeSymbol } from '@shapeshiftoss/types'
import { NETWORK_ICONS } from '@shapeshiftoss/utils'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CheckCircle2, FileCode, XCircle } from 'lucide-react'
import type React from 'react'

import { bnOrZero } from '@/lib/bignumber'
import { getExplorerUrl } from '@/lib/explorers'
import { formatCryptoAmount } from '@/lib/number'
import { formatTimestamp } from '@/lib/time'
import { formatTokenAmount, getSwapTokens, MAX_DISPLAYED_DECIMALS } from '@/lib/transactionUtils'
import { truncateAddress } from '@/lib/utils'

import { Amount } from '../ui/Amount'
import { ToolCard } from '../ui/ToolCard'
import { TxStepCard } from '../ui/TxStepCard'

import { useToolStateRender } from './toolUIHelpers'
import type { ToolUIComponentProps } from './toolUIHelpers'
import { TransactionInfographic } from './TransactionInfographic'

const TRANSACTION_ICONS: Record<ParsedTransaction['type'], React.ReactElement> = {
  send: <ArrowUpRight className="w-5 h-5 text-orange-500" />,
  receive: <ArrowDownLeft className="w-5 h-5 text-green-500" />,
  swap: <ArrowLeftRight className="w-5 h-5 text-blue-500" />,
  contract: <FileCode className="w-5 h-5 text-purple-500" />,
}

function getNativeSymbol(network?: string): string {
  if (!network) return 'ETH'
  return networkToNativeSymbol[network as Network] ?? 'ETH'
}

function TxSecondaryText({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-medium text-muted-foreground">{children}</span>
}

function TxAmount({
  children,
  variant = 'default',
}: {
  children: React.ReactNode
  variant?: 'positive' | 'negative' | 'default'
}) {
  const colorClass =
    variant === 'positive' ? 'text-green-500' : variant === 'negative' ? 'text-muted-foreground' : 'text-foreground'
  return <span className={`text-[20px] font-bold leading-tight ${colorClass}`}>{children}</span>
}

function TransactionCard({
  tx,
  network,
  networkIcon,
}: {
  tx: ParsedTransaction
  network: Network
  networkIcon?: string
}) {
  const swapTokens = getSwapTokens(tx)
  const isSwap = tx.type === 'swap'
  const isSuccess = tx.status === 'success'
  const explorerUrl = getExplorerUrl(network, tx.txid)

  const label = tx.type === 'contract' ? 'Contract interaction' : tx.type.charAt(0).toUpperCase() + tx.type.slice(1)

  return (
    <ToolCard.Root defaultOpen={false}>
      <ToolCard.Header>
        <ToolCard.HeaderRow>
          <div className="flex items-start justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                {TRANSACTION_ICONS[tx.type]}
              </div>
              <div className="flex flex-col justify-center gap-0.5">
                <TxSecondaryText>{label}</TxSecondaryText>
                {swapTokens && (
                  <TxStepCard.SwapPair
                    fromSymbol={swapTokens.tokenOut.symbol}
                    toSymbol={swapTokens.tokenIn.symbol}
                    className="-ml-0.5"
                  />
                )}
                {!swapTokens && <TxAmount>{tx.tokenTransfers?.[0]?.symbol ?? getNativeSymbol(tx.network)}</TxAmount>}
              </div>
            </div>
            <div className="flex flex-col items-end justify-center gap-0.5">
              {swapTokens && (
                <>
                  <TxSecondaryText>{formatTokenAmount(swapTokens.tokenOut)}</TxSecondaryText>
                  <TxAmount variant="positive">{formatTokenAmount(swapTokens.tokenIn)}</TxAmount>
                </>
              )}
              {!swapTokens && tx.type === 'send' && (
                <>
                  <TxSecondaryText>{truncateAddress(tx.to)}</TxSecondaryText>
                  <TxAmount variant="negative">
                    -
                    {tx.tokenTransfers?.[0]
                      ? formatTokenAmount(tx.tokenTransfers[0])
                      : formatCryptoAmount(tx.value, {
                          symbol: getNativeSymbol(tx.network),
                          decimals: MAX_DISPLAYED_DECIMALS,
                        })}
                  </TxAmount>
                </>
              )}
              {!swapTokens && tx.type === 'receive' && (
                <>
                  <TxSecondaryText>{truncateAddress(tx.from)}</TxSecondaryText>
                  <TxAmount variant="positive">
                    +
                    {tx.tokenTransfers?.[0]
                      ? formatTokenAmount(tx.tokenTransfers[0])
                      : formatCryptoAmount(tx.value, {
                          symbol: getNativeSymbol(tx.network),
                          decimals: MAX_DISPLAYED_DECIMALS,
                        })}
                  </TxAmount>
                </>
              )}
              {!swapTokens && tx.type === 'contract' && (
                <TxAmount variant="negative">
                  {tx.tokenTransfers?.[0]
                    ? formatTokenAmount(tx.tokenTransfers[0])
                    : bnOrZero(tx.value).isZero()
                      ? 'N/A'
                      : formatCryptoAmount(tx.value, {
                          symbol: getNativeSymbol(tx.network),
                          decimals: MAX_DISPLAYED_DECIMALS,
                        })}
                </TxAmount>
              )}
            </div>
          </div>
        </ToolCard.HeaderRow>
      </ToolCard.Header>

      <ToolCard.Content>
        <ToolCard.Details>
          <TransactionInfographic tx={tx} network={network} networkIcon={networkIcon} />
          <div className="space-y-3">
            <ToolCard.DetailItem
              label="TX ID"
              value={
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm text-blue-500 hover:text-blue-400 transition-colors"
                  title={tx.txid}
                >
                  {truncateAddress(tx.txid, 8, 6)}
                </a>
              }
            />
            <ToolCard.DetailItem
              label="Status"
              value={
                <div className="flex items-center gap-1">
                  {isSuccess && (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="text-green-500">Confirmed</span>
                    </>
                  )}
                  {!isSuccess && (
                    <>
                      <XCircle className="w-4 h-4 text-red-500" />
                      <span className="text-red-500">Failed</span>
                    </>
                  )}
                </div>
              }
            />
            <ToolCard.DetailItem
              label="Miner Fee"
              value={<Amount.Crypto value={tx.fee} symbol={getNativeSymbol(network)} />}
            />
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

export function GetTransactionHistoryUI({ toolPart }: ToolUIComponentProps<'transactionHistoryTool'>) {
  const input = toolPart.input as Partial<Record<string, unknown>> | undefined
  const { output, state } = toolPart

  const stateRender = useToolStateRender(state, {
    loading: `Fetching transaction history...`,
    error: `Failed to fetch transaction history ❌`,
  })

  if (stateRender) return stateRender

  if (state === 'output-error') {
    return null
  }

  if (state === 'output-available' && output && 'transactions' in output) {
    const transactions = output.transactions

    if (!transactions || transactions.length === 0) {
      return null
    }

    const renderTransactions = input?.renderTransactions

    // Early exit if explicitly told not to render
    if (renderTransactions === false) {
      return null
    }

    // Determine how many to render: specific number or all
    const renderCount = typeof renderTransactions === 'number' ? renderTransactions : transactions.length

    return (
      <div className="space-y-3">
        {transactions.slice(0, renderCount).map(tx => {
          const network = (tx.network ?? 'ethereum') as Network
          const chainId = networkToChainIdMap[network]
          const networkIcon = chainId ? NETWORK_ICONS[chainId] : undefined

          return <TransactionCard key={tx.txid} tx={tx} network={network} networkIcon={networkIcon} />
        })}
      </div>
    )
  }

  return null
}
