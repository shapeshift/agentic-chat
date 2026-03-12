import type { VaultWithdrawOutput } from '@shapeshiftoss/agentic-server'
import { toast } from 'sonner'

import { Execution } from '@/components/Execution'
import { useExecuteOnce } from '@/hooks/useExecuteOnce'
import { useToolExecution } from '@/hooks/useToolExecution'
import { toolStateToStepStatus } from '@/lib/executionState'
import { submitSafeTxStep } from '@/lib/steps/submitSafeTxStep'
import { switchNetworkStepByChainIdNumber } from '@/lib/steps/switchNetworkStep'
import { firstFourLastFour } from '@/lib/utils'

import { Amount } from '../ui/Amount'
import { Skeleton } from '../ui/Skeleton'
import { TxStepCard } from '../ui/TxStepCard'

import type { ToolUIComponentProps } from './toolUIHelpers'

const VAULT_WITHDRAW_STEPS = { PREPARE: 0, NETWORK: 1, WITHDRAW: 2 } as const

export function VaultWithdrawUI({ toolPart }: ToolUIComponentProps<'vaultWithdrawTool'>) {
  const { state: toolState, output, toolCallId } = toolPart
  const withdrawOutput = output

  const withdrawData = toolState === 'output-available' && withdrawOutput ? withdrawOutput : null

  const ctx = useToolExecution(toolCallId, 'vaultWithdrawTool', {})

  useExecuteOnce(ctx, withdrawData, async (data: VaultWithdrawOutput, ctx) => {
    try {
      const { safeTransaction, summary } = data

      if (!ctx.refs.evmAddress.current) {
        throw new Error('Wallet disconnected. Please reconnect and try again.')
      }

      ctx.setState(draft => {
        draft.toolOutput = data
        draft.meta.networkName = data.summary.network
      })
      ctx.advanceStep()

      await switchNetworkStepByChainIdNumber(ctx, safeTransaction.chainId)

      const withdrawTxHash = await submitSafeTxStep(ctx, {
        safeAddress: summary.safeAddress,
        to: safeTransaction.to,
        data: safeTransaction.data,
        value: safeTransaction.value,
        chainId: safeTransaction.chainId,
      })
      ctx.setMeta({ txHash: withdrawTxHash })
      ctx.markTerminal()
      ctx.persist()

      toast.success(
        `Vault withdrawal of ${data.summary.asset.amount} ${data.summary.asset.symbol.toUpperCase()} is complete`
      )
    } catch (error) {
      ctx.failAndPersist(error)

      toast.error(`Vault withdrawal failed`)
    }
  })

  const prepareStepStatus = toolStateToStepStatus(toolState)

  const networkName = withdrawData?.summary?.network

  const summary = withdrawOutput?.summary
  const hasError = toolState === 'output-error'
  const isLoading = !summary && !hasError

  return (
    <Execution.Root state={ctx.state} toolCallId={toolCallId}>
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
            <Execution.Step
              index={VAULT_WITHDRAW_STEPS.PREPARE}
              label="Preparing withdrawal"
              overrideStatus={prepareStepStatus}
              connectorBottom
            />
            <Execution.Step
              index={VAULT_WITHDRAW_STEPS.NETWORK}
              label={networkName ? `Switch to ${networkName}` : 'Switch network'}
              connectorTop
              connectorBottom
            />
            <Execution.Step index={VAULT_WITHDRAW_STEPS.WITHDRAW} label="Sign Safe transaction" connectorTop />
          </Execution.Stepper>
          <Execution.ErrorFooter />
        </TxStepCard.Root>
      </Execution.HistoricalGuard>
    </Execution.Root>
  )
}
