import { StepStatus, useVaultWithdrawExecution } from '@/hooks/useVaultWithdrawExecution'
import { firstFourLastFour } from '@/lib/utils'
import { useChatStore } from '@/stores/chatStore'

import { Amount } from '../ui/Amount'
import { Skeleton } from '../ui/Skeleton'
import { TxStepCard } from '../ui/TxStepCard'

import type { ToolUIComponentProps } from './toolUIHelpers'

export function VaultWithdrawUI({ toolPart }: ToolUIComponentProps<'vaultWithdrawTool'>) {
  const { state, output, toolCallId } = toolPart
  const withdrawOutput = output
  const { isHistorical, getPersistedTransaction } = useChatStore()

  const withdrawData = state === 'output-available' && withdrawOutput ? withdrawOutput : null
  const { error, steps, networkName } = useVaultWithdrawExecution(toolCallId, state, withdrawData)

  const isHistoricalSkipped = isHistorical(toolCallId) && !getPersistedTransaction(toolCallId)

  if (isHistoricalSkipped) {
    return (
      <TxStepCard.Root>
        <div className="text-sm text-muted-foreground font-medium p-4">
          Vault withdrawal execution skipped (no saved data)
        </div>
      </TxStepCard.Root>
    )
  }

  const [prepareStep, networkStep, withdrawStep] = steps
  if (!prepareStep || !networkStep || !withdrawStep) return null

  const completedCount = [prepareStep.status, networkStep.status, withdrawStep.status].filter(
    s => s === StepStatus.COMPLETE || s === StepStatus.SKIPPED
  ).length

  const footerMessage = (() => {
    if (state === 'output-error') return { type: 'error' as const, text: 'Failed to prepare vault withdrawal' }
    if (error) return { type: 'error' as const, text: `Withdrawal failed: ${error}` }
    return null
  })()

  const summary = withdrawOutput?.summary
  const hasError = state === 'output-error'
  const isLoading = !summary && !hasError

  return (
    <TxStepCard.Root>
      <TxStepCard.Header>
        <TxStepCard.HeaderRow>
          <div className="text-xs text-muted-foreground font-normal">Vault Withdrawal</div>
          {summary && <div className="text-xs text-muted-foreground font-normal">{summary.network}</div>}
        </TxStepCard.HeaderRow>
        <TxStepCard.HeaderRow>
          {summary ? (
            <div className="text-lg font-semibold">Withdraw {summary.asset.symbol.toUpperCase()}</div>
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
            <TxStepCard.DetailItem label="Safe Vault" value={firstFourLastFour(summary.safeAddress)} />
            <TxStepCard.DetailItem label="To" value={firstFourLastFour(summary.toAddress)} />
            <TxStepCard.DetailItem label="Network" value={summary.network} />
          </TxStepCard.Details>
        </TxStepCard.Content>
      )}

      <TxStepCard.Stepper completedCount={completedCount} totalCount={3}>
        <TxStepCard.Step status={prepareStep.status} connectorBottom>
          Preparing withdrawal
        </TxStepCard.Step>
        <TxStepCard.Step status={networkStep.status} connectorTop connectorBottom>
          {networkName ? `Switch to ${networkName}` : 'Switch network'}
        </TxStepCard.Step>
        <TxStepCard.Step status={withdrawStep.status} connectorTop>
          Sign Safe transaction
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
