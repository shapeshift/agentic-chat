import { Execution } from '@/components/Execution'
import { VAULT_DEPOSIT_STEPS, useVaultDepositExecution } from '@/hooks/useVaultDepositExecution'
import { StepStatus } from '@/lib/stepUtils'
import { firstFourLastFour } from '@/lib/utils'

import { Amount } from '../ui/Amount'
import { Skeleton } from '../ui/Skeleton'
import { TxStepCard } from '../ui/TxStepCard'

import type { ToolUIComponentProps } from './toolUIHelpers'

export function VaultDepositUI({ toolPart }: ToolUIComponentProps<'vaultDepositTool'>) {
  const { state: toolState, output, toolCallId } = toolPart
  const depositOutput = output

  const depositData = toolState === 'output-available' && depositOutput ? depositOutput : null
  const { state, steps, networkName } = useVaultDepositExecution(toolCallId, toolState, depositData)

  const prepareStepStatus = steps[VAULT_DEPOSIT_STEPS.PREPARE]?.status ?? StepStatus.NOT_STARTED

  const summary = depositOutput?.summary
  const hasError = toolState === 'output-error'
  const isLoading = !summary && !hasError

  return (
    <Execution.Root state={state} toolCallId={toolCallId}>
      <Execution.HistoricalGuard fallbackLabel="Vault deposit">
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

          <Execution.Stepper>
            <Execution.Step index={VAULT_DEPOSIT_STEPS.PREPARE} label="Preparing deposit" overrideStatus={prepareStepStatus} connectorBottom />
            <Execution.Step index={VAULT_DEPOSIT_STEPS.NETWORK} label={networkName ? `Switch to ${networkName}` : 'Switch network'} connectorTop connectorBottom />
            <Execution.Step index={VAULT_DEPOSIT_STEPS.DEPOSIT} label="Transfer tokens to vault" connectorTop />
          </Execution.Stepper>
          <Execution.ErrorFooter />
        </TxStepCard.Root>
      </Execution.HistoricalGuard>
    </Execution.Root>
  )
}
