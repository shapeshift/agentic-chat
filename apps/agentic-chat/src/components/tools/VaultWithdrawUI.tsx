import { Execution } from '@/components/Execution'
import { VAULT_WITHDRAW_STEPS, useVaultWithdrawExecution } from '@/hooks/useVaultWithdrawExecution'
import { StepStatus } from '@/lib/stepUtils'
import { firstFourLastFour } from '@/lib/utils'

import { Amount } from '../ui/Amount'
import { Skeleton } from '../ui/Skeleton'
import { TxStepCard } from '../ui/TxStepCard'

import type { ToolUIComponentProps } from './toolUIHelpers'

export function VaultWithdrawUI({ toolPart }: ToolUIComponentProps<'vaultWithdrawTool'>) {
  const { state: toolState, output, toolCallId } = toolPart
  const withdrawOutput = output

  const withdrawData = toolState === 'output-available' && withdrawOutput ? withdrawOutput : null
  const { state, steps, networkName } = useVaultWithdrawExecution(toolCallId, toolState, withdrawData)

  const prepareStepStatus = steps[VAULT_WITHDRAW_STEPS.PREPARE]?.status ?? StepStatus.NOT_STARTED

  const summary = withdrawOutput?.summary
  const hasError = toolState === 'output-error'
  const isLoading = !summary && !hasError

  return (
    <Execution.Root state={state} toolCallId={toolCallId}>
      <Execution.HistoricalGuard fallbackLabel="Vault withdrawal">
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

          <Execution.Stepper>
            <Execution.Step index={VAULT_WITHDRAW_STEPS.PREPARE} label="Preparing withdrawal" overrideStatus={prepareStepStatus} connectorBottom />
            <Execution.Step index={VAULT_WITHDRAW_STEPS.NETWORK} label={networkName ? `Switch to ${networkName}` : 'Switch network'} connectorTop connectorBottom />
            <Execution.Step index={VAULT_WITHDRAW_STEPS.WITHDRAW} label="Sign Safe transaction" connectorTop />
          </Execution.Stepper>
          <Execution.ErrorFooter />
        </TxStepCard.Root>
      </Execution.HistoricalGuard>
    </Execution.Root>
  )
}
