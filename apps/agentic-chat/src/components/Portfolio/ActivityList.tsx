import { useMemo } from 'react'
import { Virtuoso } from 'react-virtuoso'

import { useWalletConnection } from '@/hooks/useWalletConnection'
import { normalizeToActivityItem } from '@/lib/activityNormalizer'
import type { AnyToolExecutionState } from '@/lib/executionState'
import { useChatStore } from '@/stores/chatStore'
import type { ActivityItem } from '@/types/activity'

import { ActivityRow } from './ActivityRow'

export function ActivityList() {
  const transactions = useChatStore(state => state.persistedTransactions)
  const { evmAddress, solanaAddress, safeAddress } = useWalletConnection()

  const connectedAddresses = useMemo(() => {
    const set = new Set<string>()
    if (evmAddress) set.add(evmAddress.toLowerCase())
    if (solanaAddress) set.add(solanaAddress.toLowerCase())
    if (safeAddress) set.add(safeAddress.toLowerCase())
    return set
  }, [evmAddress, solanaAddress, safeAddress])

  const activities = useMemo(() => {
    return transactions
      .filter(
        tx =>
          tx.toolName === 'initiateSwapTool' ||
          tx.toolName === 'initiateSwapUsdTool' ||
          tx.toolName === 'sendTool' ||
          tx.toolName === 'createLimitOrderTool'
      )
      .filter(tx => !tx.error)
      .filter(tx => tx.walletAddress && connectedAddresses.has(tx.walletAddress.toLowerCase()))
      .map(tx => normalizeToActivityItem(tx as AnyToolExecutionState))
      .filter((item): item is ActivityItem => item !== null)
      .sort((a, b) => b.timestamp - a.timestamp)
  }, [transactions, connectedAddresses])

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-muted-foreground">No activity yet</div>
        <div className="text-sm text-muted-foreground mt-1">Your swaps, sends, and limit orders will appear here</div>
      </div>
    )
  }

  return (
    <Virtuoso
      data={activities}
      itemContent={(_index, activity) => (
        <div className="px-4 mb-2">
          <ActivityRow key={activity.id} activity={activity} />
        </div>
      )}
      style={{ height: '100%' }}
    />
  )
}
