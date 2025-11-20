import { useMemo } from 'react'
import { Virtuoso } from 'react-virtuoso'

import { normalizeToActivityItem } from '@/lib/activityNormalizer'
import { useChatStore } from '@/stores/chatStore'
import type { ActivityItem } from '@/types/activity'

import { ActivityRow } from './ActivityRow'

export function ActivityList() {
  const transactions = useChatStore(state => state.persistedTransactions)

  const activities = useMemo(() => {
    return transactions
      .filter(tx => tx.toolType === 'swap' || tx.toolType === 'send')
      .filter(tx => !tx.phases.includes('error'))
      .map(tx => normalizeToActivityItem(tx))
      .filter((item): item is ActivityItem => item !== null)
      .sort((a, b) => b.timestamp - a.timestamp)
  }, [transactions])

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-muted-foreground">No activity yet</div>
        <div className="text-sm text-muted-foreground mt-1">Your swap and send transactions will appear here</div>
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
