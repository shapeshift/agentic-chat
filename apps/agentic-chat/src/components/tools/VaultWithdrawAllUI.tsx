import { StepStatus, useVaultWithdrawAllExecution } from '@/hooks/useVaultWithdrawAllExecution'
import { getExplorerUrl } from '@/lib/explorers'
import { firstFourLastFour } from '@/lib/utils'
import { useChatStore } from '@/stores/chatStore'

import { Amount } from '../ui/Amount'
import { Skeleton } from '../ui/Skeleton'
import { TxStepCard } from '../ui/TxStepCard'

import type { ToolUIComponentProps } from './toolUIHelpers'

export function VaultWithdrawAllUI({ toolPart }: ToolUIComponentProps<'vaultWithdrawAllTool'>) {
  const { state, output, toolCallId } = toolPart
  const withdrawOutput = output
  const { isHistorical, getPersistedTransaction } = useChatStore()

  const withdrawData = state === 'output-available' && withdrawOutput ? withdrawOutput : null
  const { error, steps, chainResults, currentChainIndex, totalChains } = useVaultWithdrawAllExecution(
    toolCallId,
    state,
    withdrawData
  )

  const isHistoricalSkipped = isHistorical(toolCallId) && !getPersistedTransaction(toolCallId)

  if (isHistoricalSkipped) {
    return (
      <TxStepCard.Root>
        <div className="text-sm text-muted-foreground font-medium p-4">
          Vault withdraw all execution skipped (no saved data)
        </div>
      </TxStepCard.Root>
    )
  }

  const [prepareStep, withdrawChainsStep] = steps
  if (!prepareStep || !withdrawChainsStep) return null

  const completedCount = [prepareStep.status, withdrawChainsStep.status].filter(
    s => s === StepStatus.COMPLETE || s === StepStatus.SKIPPED
  ).length

  const footerMessage = (() => {
    if (state === 'output-error') return { type: 'error' as const, text: 'Failed to prepare vault withdrawal' }
    if (error) return { type: 'error' as const, text: `Withdrawal failed: ${error}` }
    return null
  })()

  const hasError = state === 'output-error'
  const isLoading = !withdrawOutput && !hasError

  return (
    <TxStepCard.Root>
      <TxStepCard.Header>
        <TxStepCard.HeaderRow>
          <div className="text-xs text-muted-foreground font-normal">Vault Withdraw All</div>
          {withdrawOutput && (
            <div className="text-xs text-muted-foreground font-normal">
              {withdrawOutput.withdrawals.length} chain{withdrawOutput.withdrawals.length !== 1 ? 's' : ''}
            </div>
          )}
        </TxStepCard.HeaderRow>
        <TxStepCard.HeaderRow>
          {withdrawOutput ? (
            <div className="text-lg font-semibold">Withdraw All Vault Tokens</div>
          ) : isLoading ? (
            <Skeleton className="h-7 w-52" />
          ) : null}
          {withdrawOutput && <TxStepCard.Amount value={`$${withdrawOutput.totalUsd}`} isLoading={isLoading} />}
        </TxStepCard.HeaderRow>
      </TxStepCard.Header>

      {withdrawOutput && (
        <TxStepCard.Content>
          {withdrawOutput.withdrawals.map(withdrawal => (
            <div key={withdrawal.chainId} className="mb-3 last:mb-0">
              <div className="text-xs font-medium text-muted-foreground mb-1 capitalize">{withdrawal.network}</div>
              <TxStepCard.Details>
                {withdrawal.tokens.map((token, i) => (
                  <TxStepCard.DetailItem
                    key={i}
                    label={token.symbol}
                    value={
                      <span className="flex items-center gap-2">
                        <Amount.Crypto value={token.amount} symbol={token.symbol} />
                        <span className="text-muted-foreground">
                          (<Amount.Fiat value={token.usdValue} />)
                        </span>
                      </span>
                    }
                  />
                ))}
                <TxStepCard.DetailItem label="Safe" value={firstFourLastFour(withdrawal.safeAddress)} />
                <TxStepCard.DetailItem label="To" value={firstFourLastFour(withdrawal.toAddress)} />
              </TxStepCard.Details>
            </div>
          ))}
        </TxStepCard.Content>
      )}

      <TxStepCard.Stepper completedCount={completedCount} totalCount={2}>
        <TxStepCard.Step status={prepareStep.status} connectorBottom>
          Preparing withdrawals
        </TxStepCard.Step>
        <TxStepCard.Step status={withdrawChainsStep.status} connectorTop>
          {totalChains > 1
            ? `Sign transactions (${Math.min(currentChainIndex + 1, totalChains)}/${totalChains} chains)`
            : 'Sign Safe transaction'}
        </TxStepCard.Step>

        {chainResults.length > 0 && (
          <div className="mt-3 space-y-1">
            {chainResults.map(result => (
              <div key={result.chainId} className="flex items-center gap-2 text-xs">
                <span className="capitalize font-medium">{result.network}:</span>
                {result.txHash ? (
                  <a
                    href={getExplorerUrl(result.network, result.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    {firstFourLastFour(result.txHash)}
                  </a>
                ) : result.error ? (
                  <span className="text-red-500">Failed</span>
                ) : null}
              </div>
            ))}
          </div>
        )}

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
