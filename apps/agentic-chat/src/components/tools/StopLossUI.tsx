import { ExternalLink, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { useMemo } from 'react'

import { useStopLossExecution } from '@/hooks/useStopLossExecution'
import { getExplorerUrl, getSafeAppUrl } from '@/lib/explorers'
import { StepStatus } from '@/lib/stepUtils'
import { useChatStore } from '@/stores/chatStore'

import { Amount } from '../ui/Amount'
import { Skeleton } from '../ui/Skeleton'
import { TruncateText } from '../ui/TruncateText'
import { TxStepCard } from '../ui/TxStepCard'

import type { ToolUIComponentProps } from './toolUIHelpers'

interface PresentationStep {
  label: string
  status: StepStatus
  subtitle?: ReactNode
}

const walletSigningSubtitle = (
  <span className="flex items-center gap-1">
    <Wallet className="h-3 w-3" />
    Sign in your wallet...
  </span>
)

const walletConfirmingSubtitle = (
  <span className="flex items-center gap-1">
    <Wallet className="h-3 w-3" />
    Waiting for confirmation...
  </span>
)

function mergeStepStatuses(actionStatus: StepStatus, confirmStatus: StepStatus): StepStatus {
  if (actionStatus === StepStatus.FAILED) return StepStatus.FAILED
  if (confirmStatus === StepStatus.FAILED) return StepStatus.FAILED
  if (actionStatus === StepStatus.IN_PROGRESS) return StepStatus.IN_PROGRESS
  if (actionStatus === StepStatus.COMPLETE && confirmStatus !== StepStatus.COMPLETE) return StepStatus.IN_PROGRESS
  if (actionStatus === StepStatus.COMPLETE && confirmStatus === StepStatus.COMPLETE) return StepStatus.COMPLETE
  if (actionStatus === StepStatus.NOT_STARTED && confirmStatus === StepStatus.NOT_STARTED) return StepStatus.NOT_STARTED
  return StepStatus.NOT_STARTED
}

function getMergedSubtitle(actionStatus: StepStatus, confirmStatus: StepStatus): ReactNode | undefined {
  if (actionStatus === StepStatus.IN_PROGRESS) return walletSigningSubtitle
  if (actionStatus === StepStatus.COMPLETE && confirmStatus !== StepStatus.COMPLETE) return walletConfirmingSubtitle
  return undefined
}

function getUserFriendlyError(rawError: string): string {
  const lower = rawError.toLowerCase()
  if (lower.includes('user rejected') || lower.includes('user denied')) return 'Transaction was rejected in your wallet'
  if (lower.includes('insufficient funds')) return 'Insufficient funds to complete this transaction'
  if (lower.includes('failed to deploy safe')) return 'Failed to set up your vault. Please try again.'
  return rawError.length > 120 ? `${rawError.slice(0, 120)}...` : rawError
}

export function StopLossUI({ toolPart }: ToolUIComponentProps<'createStopLossTool'>) {
  const { state, output, toolCallId, errorText } = toolPart
  const orderOutput = output
  const { isHistorical, getPersistedTransaction } = useChatStore()

  const orderData = state === 'output-available' && orderOutput ? orderOutput : null
  const { error, steps, networkName, submitTxHash } = useStopLossExecution(toolCallId, state, orderData)

  const needsDeposit = orderOutput?.needsDeposit ?? false
  const needsApproval = orderOutput?.needsApproval ?? false
  const summary = orderOutput?.summary
  const sellSymbol = summary?.sellAsset.symbol.toUpperCase()
  const sellAmount = summary?.sellAsset.amount

  const [
    prepareStep,
    networkStep,
    safeCheckStep,
    depositStep,
    depositConfirmStep,
    approvalStep,
    approvalConfirmStep,
    submitStep,
    confirmStep,
  ] = steps

  const presentationSteps: PresentationStep[] = useMemo(() => {
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
      return []
    }

    const result: PresentationStep[] = [
      {
        label: 'Preparing stop-loss order',
        status: prepareStep.status,
      },
      {
        label: 'Setting up vault',
        status: safeCheckStep.status,
        subtitle: safeCheckStep.status === StepStatus.IN_PROGRESS ? walletSigningSubtitle : undefined,
      },
      {
        label: networkName ? `Switching to ${networkName}` : 'Switching network',
        status: networkStep.status,
        subtitle: networkStep.status === StepStatus.IN_PROGRESS ? walletSigningSubtitle : undefined,
      },
    ]

    if (needsDeposit) {
      const depositLabel =
        sellAmount && sellSymbol ? `Depositing ${sellAmount} ${sellSymbol} to vault` : 'Depositing tokens to vault'
      result.push({
        label: depositLabel,
        status: mergeStepStatuses(depositStep.status, depositConfirmStep.status),
        subtitle: getMergedSubtitle(depositStep.status, depositConfirmStep.status),
      })
    }

    if (needsApproval) {
      const approvalLabel = sellSymbol ? `Approving ${sellSymbol} for trading` : 'Approving token for trading'
      result.push({
        label: approvalLabel,
        status: mergeStepStatuses(approvalStep.status, approvalConfirmStep.status),
        subtitle: getMergedSubtitle(approvalStep.status, approvalConfirmStep.status),
      })
    }

    result.push(
      {
        label: 'Submitting stop-loss order',
        status: submitStep.status,
        subtitle: submitStep.status === StepStatus.IN_PROGRESS ? walletSigningSubtitle : undefined,
      },
      {
        label: 'Confirming on-chain',
        status: confirmStep.status,
      }
    )

    return result
  }, [
    prepareStep,
    safeCheckStep,
    networkStep,
    networkName,
    needsDeposit,
    sellAmount,
    sellSymbol,
    depositStep,
    depositConfirmStep,
    needsApproval,
    approvalStep,
    approvalConfirmStep,
    submitStep,
    confirmStep,
  ])

  const isHistoricalSkipped = isHistorical(toolCallId) && !getPersistedTransaction(toolCallId)

  if (isHistoricalSkipped) {
    return (
      <TxStepCard.Root>
        <div className="text-sm text-muted-foreground font-medium p-4">Stop-loss execution skipped (no saved data)</div>
      </TxStepCard.Root>
    )
  }

  if (presentationSteps.length === 0) {
    return (
      <TxStepCard.Root>
        <div className="text-sm text-muted-foreground font-medium p-4">
          Unable to load stop-loss steps. Please try again.
        </div>
      </TxStepCard.Root>
    )
  }

  const completedCount = presentationSteps.filter(s => s.status === StepStatus.COMPLETE).length
  const totalCount = presentationSteps.length

  const footerMessage = (() => {
    if (state === 'output-error')
      return { type: 'error' as const, text: errorText ? `Stop-loss failed: ${getUserFriendlyError(errorText)}` : 'Failed to prepare stop-loss order' }
    if (error) return { type: 'error' as const, text: `Stop-loss failed: ${getUserFriendlyError(error)}` }
    return null
  })()

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
            {orderOutput?.safeAddress && summary && (
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

      <TxStepCard.Stepper completedCount={completedCount} totalCount={totalCount}>
        {presentationSteps.map((step, index) => (
          <TxStepCard.Step
            key={step.label}
            status={step.status}
            subtitle={step.subtitle}
            connectorTop={index > 0}
            connectorBottom={index < presentationSteps.length - 1}
          >
            {step.label}
          </TxStepCard.Step>
        ))}

        {submitTxHash && networkName && (
          <a
            href={getExplorerUrl(networkName, submitTxHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-primary hover:underline mt-3"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="font-mono text-xs">
              {submitTxHash.slice(0, 10)}...{submitTxHash.slice(-8)}
            </span>
          </a>
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
