import { Execution } from '@/components/Execution'
import { getExplorerUrl } from '@/lib/explorers'
import { StepStatus } from '@/lib/stepUtils'
import { firstFourLastFour } from '@/lib/utils'

import { Amount } from '../ui/Amount'
import { Skeleton } from '../ui/Skeleton'
import { TxStepCard } from '../ui/TxStepCard'

import type { ToolUIComponentProps } from './toolUIHelpers'
import { VAULT_WITHDRAW_ALL_STEPS, useVaultWithdrawAllExecution } from './useVaultWithdrawAllExecution'

export function VaultWithdrawAllUI({ toolPart }: ToolUIComponentProps<'vaultWithdrawAllTool'>) {
  const { state: toolState, output, toolCallId } = toolPart
  const withdrawOutput = output

  const withdrawData = toolState === 'output-available' && withdrawOutput ? withdrawOutput : null
  const { state, steps, chainResults, currentChainIndex, totalChains } = useVaultWithdrawAllExecution(
    toolCallId,
    toolState,
    withdrawData
  )

  const prepareStepStatus = steps[VAULT_WITHDRAW_ALL_STEPS.PREPARE]?.status ?? StepStatus.NOT_STARTED

  const hasError = toolState === 'output-error'
  const isLoading = !withdrawOutput && !hasError

  const withdrawChainsLabel =
    totalChains > 1
      ? `Sign transactions (${Math.min(currentChainIndex + 1, totalChains)}/${totalChains} chains)`
      : 'Sign Safe transaction'

  return (
    <Execution.Root state={state} toolCallId={toolCallId}>
      <Execution.HistoricalGuard fallbackLabel="Vault withdraw all">
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

          <Execution.Stepper>
            <Execution.Step
              index={VAULT_WITHDRAW_ALL_STEPS.PREPARE}
              label="Preparing withdrawals"
              overrideStatus={prepareStepStatus}
              connectorBottom
            />
            <Execution.Step index={VAULT_WITHDRAW_ALL_STEPS.WITHDRAW_CHAINS} label={withdrawChainsLabel} connectorTop />
          </Execution.Stepper>

          {chainResults.length > 0 && (
            <div className="mt-3 space-y-1 px-4 pb-4">
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

          <Execution.ErrorFooter />
        </TxStepCard.Root>
      </Execution.HistoricalGuard>
    </Execution.Root>
  )
}
