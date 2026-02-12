import type { CreateStopLossOutput } from '@shapeshiftoss/agentic-server'

import { useStopLossExecution } from '@/hooks/useStopLossExecution'
import { StepStatus } from '@/lib/stepUtils'
import { useChatStore } from '@/stores/chatStore'

import { Amount } from '../ui/Amount'
import { Skeleton } from '../ui/Skeleton'
import { TruncateText } from '../ui/TruncateText'
import { TxStepCard } from '../ui/TxStepCard'

import type { ToolUIComponentProps } from './toolUIHelpers'

export function StopLossUI({ toolPart }: ToolUIComponentProps) {
  const { state, output, toolCallId } = toolPart
  const orderOutput = output as CreateStopLossOutput | undefined
  const { isHistorical, getPersistedTransaction } = useChatStore()

  const orderData = state === 'output-available' && orderOutput ? orderOutput : null
  const { error, steps, networkName, submitTxHash } = useStopLossExecution(toolCallId, state, orderData)
  const needsApproval = orderOutput?.needsApproval ?? false

  const isHistoricalSkipped = isHistorical(toolCallId) && !getPersistedTransaction(toolCallId)

  if (isHistoricalSkipped) {
    return (
      <TxStepCard.Root>
        <div className="text-sm text-muted-foreground font-medium p-4">Stop-loss execution skipped (no saved data)</div>
      </TxStepCard.Root>
    )
  }

  const needsDeposit = orderOutput?.needsDeposit ?? false
  const [
    prepareStep,
    safeCheckStep,
    networkStep,
    depositStep,
    depositConfirmStep,
    approvalStep,
    approvalConfirmStep,
    submitStep,
    confirmStep,
  ] = steps
  if (
    !prepareStep ||
    !safeCheckStep ||
    !networkStep ||
    !depositStep ||
    !depositConfirmStep ||
    !approvalStep ||
    !approvalConfirmStep ||
    !submitStep ||
    !confirmStep
  ) {
    return (
      <TxStepCard.Root>
        <div className="text-sm text-muted-foreground font-medium p-4">
          Unable to load stop-loss steps. Please try again.
        </div>
      </TxStepCard.Root>
    )
  }

  const completedCount = [
    prepareStep.status,
    safeCheckStep.status,
    networkStep.status,
    depositStep.status,
    depositConfirmStep.status,
    approvalStep.status,
    approvalConfirmStep.status,
    submitStep.status,
    confirmStep.status,
  ].filter(s => s === StepStatus.COMPLETE || s === StepStatus.SKIPPED).length

  const footerMessage = (() => {
    if (state === 'output-error') return { type: 'error' as const, text: 'Failed to prepare stop-loss order' }
    if (error) return { type: 'error' as const, text: `Stop-loss failed: ${error}` }
    return null
  })()

  const summary = orderOutput?.summary
  const hasError = state === 'output-error'
  const isLoading = !summary && !hasError

  return (
    <TxStepCard.Root>
      <TxStepCard.Header>
        <TxStepCard.HeaderRow>
          <div className="text-xs text-muted-foreground font-normal">Stop-Loss Order</div>
          <div className="text-sm text-muted-foreground font-normal">
            {summary
              ? `Expires ${new Date(summary.expiresAt).toLocaleDateString()}`
              : isLoading && <Skeleton className="h-4 w-20" />}
          </div>
        </TxStepCard.HeaderRow>
        <TxStepCard.HeaderRow>
          <TxStepCard.SwapPair
            fromSymbol={summary?.sellAsset.symbol.toUpperCase()}
            toSymbol={summary?.buyAsset.symbol.toUpperCase()}
            isLoading={isLoading}
          />
          <TxStepCard.Amount
            value={summary?.sellAsset.amount}
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
              label="Sell Amount"
              value={<Amount.Crypto value={summary.sellAsset.amount} symbol={summary.sellAsset.symbol.toUpperCase()} />}
            />
            <TxStepCard.DetailItem label="Trigger Price" value={`$${summary.triggerPrice}`} />
            <TxStepCard.DetailItem label="Current Price" value={`$${summary.currentPrice}`} />
            <TxStepCard.DetailItem label="Distance" value={`${summary.priceDistancePercent}% below current`} />
            <TxStepCard.DetailItem
              label="Est. Receive"
              value={
                <Amount.Crypto
                  value={summary.buyAsset.estimatedAmount}
                  symbol={summary.buyAsset.symbol.toUpperCase()}
                />
              }
            />
            <TxStepCard.DetailItem label="Expires" value={new Date(summary.expiresAt).toLocaleString()} />
            {orderOutput?.safeAddress && (
              <TxStepCard.DetailItem
                label="Safe"
                value={`${orderOutput.safeAddress.slice(0, 6)}...${orderOutput.safeAddress.slice(-4)}`}
              />
            )}
            <TxStepCard.DetailItem label="Provider" value={summary.provider.toUpperCase()} />
          </TxStepCard.Details>
        </TxStepCard.Content>
      )}

      <TxStepCard.Stepper completedCount={completedCount} totalCount={9}>
        <TxStepCard.Step status={prepareStep.status} connectorBottom>
          Preparing stop-loss order
        </TxStepCard.Step>
        <TxStepCard.Step status={safeCheckStep.status} connectorTop connectorBottom>
          Check Safe wallet
        </TxStepCard.Step>
        <TxStepCard.Step status={networkStep.status} connectorTop connectorBottom>
          {networkName ? `Switch to ${networkName}` : 'Switch network'}
        </TxStepCard.Step>
        <TxStepCard.Step status={needsDeposit ? depositStep.status : StepStatus.SKIPPED} connectorTop connectorBottom>
          Deposit tokens to vault
        </TxStepCard.Step>
        <TxStepCard.Step
          status={needsDeposit ? depositConfirmStep.status : StepStatus.SKIPPED}
          connectorTop
          connectorBottom
        >
          Confirming deposit
        </TxStepCard.Step>
        <TxStepCard.Step status={needsApproval ? approvalStep.status : StepStatus.SKIPPED} connectorTop connectorBottom>
          Approve token via Safe
        </TxStepCard.Step>
        <TxStepCard.Step
          status={needsApproval ? approvalConfirmStep.status : StepStatus.SKIPPED}
          connectorTop
          connectorBottom
        >
          Confirming approval
        </TxStepCard.Step>
        <TxStepCard.Step status={submitStep.status} connectorTop connectorBottom>
          Submit to ComposableCoW
        </TxStepCard.Step>
        <TxStepCard.Step status={confirmStep.status} connectorTop>
          Confirming on-chain
        </TxStepCard.Step>

        {submitTxHash && (
          <div className="text-sm text-muted-foreground mt-3">
            Tx:{' '}
            <span className="font-mono text-xs">
              {submitTxHash.slice(0, 10)}...{submitTxHash.slice(-8)}
            </span>
          </div>
        )}

        {footerMessage && (
          <TruncateText
            text={footerMessage.text}
            limit={80}
            className={`text-sm font-medium mt-4 ${footerMessage.type === 'error' ? 'text-red-500' : 'text-muted-foreground'}`}
          />
        )}
      </TxStepCard.Stepper>
    </TxStepCard.Root>
  )
}
