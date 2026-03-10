import type { VaultDepositOutput } from '@shapeshiftoss/agentic-server'
import { fromChainId } from '@shapeshiftoss/caip'
import { toast } from 'sonner'

import { Execution } from '@/components/Execution'
import { useExecuteOnce } from '@/hooks/useExecuteOnce'
import { useToolExecution } from '@/hooks/useToolExecution'
import type { VaultDepositMeta } from '@/lib/executionState'
import { toolStateToStepStatus } from '@/lib/executionState'
import { switchNetworkStepByChainIdNumber } from '@/lib/steps/switchNetworkStep'
import { firstFourLastFour } from '@/lib/utils'
import { sendTransaction } from '@/utils/sendTransaction'

import { Amount } from '../ui/Amount'
import { Skeleton } from '../ui/Skeleton'
import { TxStepCard } from '../ui/TxStepCard'

import type { ToolUIComponentProps } from './toolUIHelpers'

const VAULT_DEPOSIT_STEPS = { PREPARE: 0, NETWORK: 1, DEPOSIT: 2 } as const

export function VaultDepositUI({ toolPart }: ToolUIComponentProps<'vaultDepositTool'>) {
  const { state: toolState, output, toolCallId } = toolPart
  const depositOutput = output

  const depositData = toolState === 'output-available' && depositOutput ? depositOutput : null

  const ctx = useToolExecution<VaultDepositMeta>(toolCallId, 'vault_deposit', {})

  useExecuteOnce(ctx, depositData, async (data: VaultDepositOutput, ctx) => {
    try {
      const { depositTx } = data

      if (!ctx.refs.evmAddress.current) {
        throw new Error('Wallet disconnected. Please reconnect and try again.')
      }

      ctx.setState(draft => {
        draft.toolOutput = data
        draft.meta.networkName = data.summary.network
      })
      ctx.advanceStep()

      const { chainReference } = fromChainId(depositTx.chainId)
      await switchNetworkStepByChainIdNumber(ctx, Number(chainReference))

      const depositTxHash = await sendTransaction({
        chainId: depositTx.chainId,
        data: depositTx.data,
        from: depositTx.from,
        to: depositTx.to,
        value: depositTx.value,
      })
      ctx.setMeta({ depositTxHash })
      ctx.advanceStep()
      ctx.markTerminal()
      ctx.persist()

      toast.success(
        `Vault deposit of ${data.summary.asset.amount} ${data.summary.asset.symbol.toUpperCase()} is complete`
      )
    } catch (error) {
      ctx.failAndPersist(error)

      toast.error(`Vault deposit failed`)
    }
  })

  const prepareStepStatus = toolStateToStepStatus(toolState)

  const networkName = depositData?.summary?.network

  const summary = depositOutput?.summary
  const hasError = toolState === 'output-error'
  const isLoading = !summary && !hasError

  return (
    <Execution.Root state={ctx.state} toolCallId={toolCallId}>
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
            <Execution.Step
              index={VAULT_DEPOSIT_STEPS.PREPARE}
              label="Preparing deposit"
              overrideStatus={prepareStepStatus}
              connectorBottom
            />
            <Execution.Step
              index={VAULT_DEPOSIT_STEPS.NETWORK}
              label={networkName ? `Switch to ${networkName}` : 'Switch network'}
              connectorTop
              connectorBottom
            />
            <Execution.Step index={VAULT_DEPOSIT_STEPS.DEPOSIT} label="Transfer tokens to vault" connectorTop />
          </Execution.Stepper>
          <Execution.ErrorFooter />
        </TxStepCard.Root>
      </Execution.HistoricalGuard>
    </Execution.Root>
  )
}
