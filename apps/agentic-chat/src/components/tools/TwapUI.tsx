import { ExternalLink } from 'lucide-react'

import { Execution } from '@/components/Execution'
import { CONDITIONAL_ORDER_STEPS, useTwapExecution } from '@/hooks/useTwapExecution'
import { getExplorerUrl, getSafeAppUrl } from '@/lib/explorers'
import { formatDuration, formatFrequency } from '@/lib/formatDuration'
import { StepStatus } from '@/lib/stepUtils'

import { Amount } from '../ui/Amount'
import { Skeleton } from '../ui/Skeleton'
import { TxStepCard } from '../ui/TxStepCard'

import type { ToolUIComponentProps } from './toolUIHelpers'

export function TwapUI({ toolPart }: ToolUIComponentProps<'createTwapTool'>) {
  const { state: toolState, output, toolCallId } = toolPart
  const orderOutput = output

  const orderData = toolState === 'output-available' && orderOutput ? orderOutput : null
  const { state, steps, networkName, submitTxHash } = useTwapExecution(toolCallId, toolState, orderData)

  const needsDeposit = orderOutput?.needsDeposit ?? false
  const needsApproval = orderOutput?.needsApproval ?? false
  const summary = orderOutput?.summary
  const duration = summary ? formatDuration(summary.durationSeconds) : undefined
  const frequency = summary ? formatFrequency(Math.floor(summary.durationSeconds / summary.intervals)) : undefined
  const sellSymbol = summary?.sellAsset.symbol.toUpperCase()
  const sellAmount = summary?.sellAsset.totalAmount

  const prepareStepStatus = steps[CONDITIONAL_ORDER_STEPS.PREPARE]?.status ?? StepStatus.NOT_STARTED

  const hasError = toolState === 'output-error'
  const isLoading = !summary && !hasError

  const depositLabel =
    sellAmount && sellSymbol ? `Deposit ${sellAmount} ${sellSymbol} to vault` : 'Deposit tokens to vault'
  const approvalLabel = sellSymbol ? `Approve ${sellSymbol} via Safe` : 'Approve token via Safe'

  return (
    <Execution.Root state={state} toolCallId={toolCallId}>
      <Execution.HistoricalGuard fallbackLabel="TWAP">
        <TxStepCard.Root>
          <TxStepCard.Header>
            <TxStepCard.HeaderRow>
              <div className="text-xs text-muted-foreground font-normal">TWAP Order</div>
              <div className="text-sm text-muted-foreground font-normal">
                {summary ? duration : isLoading && <Skeleton className="h-4 w-20" />}
              </div>
            </TxStepCard.HeaderRow>
            <TxStepCard.HeaderRow>
              <TxStepCard.SwapPair
                fromSymbol={summary?.sellAsset.symbol.toUpperCase()}
                toSymbol={summary?.buyAsset.symbol.toUpperCase()}
                isLoading={isLoading}
              />
              <TxStepCard.Amount
                value={summary?.sellAsset.totalAmount}
                symbol={summary?.sellAsset.symbol.toUpperCase()}
                isLoading={isLoading}
              />
            </TxStepCard.HeaderRow>
          </TxStepCard.Header>

          {summary && (
            <TxStepCard.Content>
              <TxStepCard.Details>
                <TxStepCard.DetailItem
                  label="Pair"
                  value={`${summary.sellAsset.symbol.toUpperCase()} → ${summary.buyAsset.symbol.toUpperCase()}`}
                />
                <TxStepCard.DetailItem
                  label="Total Amount"
                  value={
                    <Amount.Crypto value={summary.sellAsset.totalAmount} symbol={summary.sellAsset.symbol.toUpperCase()} />
                  }
                />
                <TxStepCard.DetailItem
                  label="Per-Trade Amount"
                  value={
                    <Amount.Crypto
                      value={summary.sellAsset.perTradeAmount}
                      symbol={summary.sellAsset.symbol.toUpperCase()}
                    />
                  }
                />
                <TxStepCard.DetailItem label="Intervals" value={String(summary.intervals)} />
                <TxStepCard.DetailItem label="Frequency" value={frequency} />
                <TxStepCard.DetailItem label="Duration" value={duration} />
                {orderOutput?.safeAddress && (
                  <TxStepCard.DetailItem
                    label="Safe Vault"
                    value={
                      <a
                        href={getSafeAppUrl(summary.network, orderOutput.safeAddress)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        {orderOutput.safeAddress.slice(0, 6)}...{orderOutput.safeAddress.slice(-4)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    }
                  />
                )}
                <TxStepCard.DetailItem label="Provider" value={summary.provider.toUpperCase()} />
              </TxStepCard.Details>
            </TxStepCard.Content>
          )}

          {(orderOutput as { warnings?: string[] })?.warnings?.map((warning: string, i: number) => (
            <p key={i} className="text-sm text-amber-500 font-medium px-4 py-2">
              {warning}
            </p>
          ))}

          <Execution.Stepper>
            <Execution.Step
              index={CONDITIONAL_ORDER_STEPS.PREPARE}
              label="Preparing TWAP order"
              overrideStatus={prepareStepStatus}
              connectorBottom
            />
            <Execution.Step
              index={CONDITIONAL_ORDER_STEPS.NETWORK}
              label={networkName ? `Switch to ${networkName}` : 'Switch network'}
              connectorTop
              connectorBottom
            />
            <Execution.Step
              index={CONDITIONAL_ORDER_STEPS.SAFE_CHECK}
              label="Check Safe wallet"
              connectorTop
              connectorBottom
            />
            <Execution.Step
              index={CONDITIONAL_ORDER_STEPS.DEPOSIT}
              label={depositLabel}
              overrideStatus={!needsDeposit ? StepStatus.SKIPPED : undefined}
              connectorTop
              connectorBottom
            />
            <Execution.Step
              index={CONDITIONAL_ORDER_STEPS.APPROVE}
              label={approvalLabel}
              overrideStatus={!needsApproval ? StepStatus.SKIPPED : undefined}
              connectorTop
              connectorBottom
            />
            <Execution.Step
              index={CONDITIONAL_ORDER_STEPS.SUBMIT}
              label="Submit to ComposableCoW"
              connectorTop
            />
          </Execution.Stepper>

          {submitTxHash && networkName && (
            <a
              href={getExplorerUrl(networkName, submitTxHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-primary hover:underline mt-3 px-4 pb-4"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="font-mono text-xs">
                {submitTxHash.slice(0, 10)}...{submitTxHash.slice(-8)}
              </span>
            </a>
          )}

          <Execution.ErrorFooter />
        </TxStepCard.Root>
      </Execution.HistoricalGuard>
    </Execution.Root>
  )
}
