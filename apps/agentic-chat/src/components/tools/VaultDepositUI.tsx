import { StepStatus, useVaultDepositExecution } from '@/hooks/useVaultDepositExecution'
import { firstFourLastFour } from '@/lib/utils'
import { useChatStore } from '@/stores/chatStore'

import { Amount } from '../ui/Amount'
import { Skeleton } from '../ui/Skeleton'
import { TxStepCard } from '../ui/TxStepCard'

import type { ToolUIComponentProps } from './toolUIHelpers'

export function VaultDepositUI({ toolPart }: ToolUIComponentProps<'vaultDepositTool'>) {
  const { state, output, toolCallId } = toolPart
  const depositOutput = output
  const { isHistorical, getPersistedTransaction } = useChatStore()

  const depositData = state === 'output-available' && depositOutput ? depositOutput : null
  const { error, steps, networkName } = useVaultDepositExecution(toolCallId, state, depositData)

  const isHistoricalSkipped = isHistorical(toolCallId) && !getPersistedTransaction(toolCallId)

  if (isHistoricalSkipped) {
    return (
      <TxStepCard.Root>
        <div className="text-sm text-muted-foreground font-medium p-4">
          Vault deposit execution skipped (no saved data)
        </div>
      </TxStepCard.Root>
    )
  }

  const [prepareStep, networkStep, depositStep] = steps
  if (!prepareStep || !networkStep || !depositStep)
    return (
      <TxStepCard.Root>
        <div className="text-sm text-muted-foreground font-medium p-4">Unable to load steps. Please try again.</div>
      </TxStepCard.Root>
    )

  const completedCount = [prepareStep.status, networkStep.status, depositStep.status].filter(
    s => s === StepStatus.COMPLETE || s === StepStatus.SKIPPED
  ).length

  const footerMessage = (() => {
    if (state === 'output-error') return { type: 'error' as const, text: 'Failed to prepare vault deposit' }
    if (error) return { type: 'error' as const, text: `Deposit failed: ${error}` }
    return null
  })()

  const summary = depositOutput?.summary
  const hasError = state === 'output-error'
  const isLoading = !summary && !hasError

  return (
    <TxStepCard.Root>
      <TxStepCard.Header>
        <TxStepCard.HeaderRow>
          <div className="text-xs text-muted-foreground font-normal">Vault Deposit</div>
          {summary && <div className="text-xs text-muted-foreground font-normal">{summary.network}</div>}
        </TxStepCard.HeaderRow>
        <TxStepCard.HeaderRow>
          {summary ? (
            <div className="text-lg font-semibold">Deposit {summary.asset.symbol.toUpperCase()}</div>
          ) : isLoading ? (
            <Skeleton className="h-7 w-40" />
          ) : null}
          <TxStepCard.Amount
            value={summary?.asset.amount}
            symbol={summary?.asset.symbol.toUpperCase()}
            isLoading={isLoading}
          />
        </TxStepCard.HeaderRow>
      </TxStepCard.Header>

      {summary && (
        <TxStepCard.Content>
          <TxStepCard.Details>
            <TxStepCard.DetailItem
              label="Asset"
              value={<Amount.Crypto value={summary.asset.amount} symbol={summary.asset.symbol.toUpperCase()} />}
            />
            <TxStepCard.DetailItem label="From" value={firstFourLastFour(summary.fromAddress)} />
            <TxStepCard.DetailItem label="Safe Vault" value={firstFourLastFour(summary.safeAddress)} />
            <TxStepCard.DetailItem label="Network" value={summary.network} />
          </TxStepCard.Details>
        </TxStepCard.Content>
      )}

      <TxStepCard.Stepper completedCount={completedCount} totalCount={3}>
        <TxStepCard.Step status={prepareStep.status} connectorBottom>
          Preparing deposit
        </TxStepCard.Step>
        <TxStepCard.Step status={networkStep.status} connectorTop connectorBottom>
          {networkName ? `Switch to ${networkName}` : 'Switch network'}
        </TxStepCard.Step>
        <TxStepCard.Step status={depositStep.status} connectorTop>
          Transfer tokens to vault
        </TxStepCard.Step>
        {footerMessage && (
          <div
            className={`text-sm font-medium mt-4 ${footerMessage.type === 'error' ? 'text-red-500' : 'text-muted-foreground'}`}
          >
            {footerMessage.text}
          </div>
        )}
      </TxStepCard.Stepper>
    </TxStepCard.Root>
  )
}
