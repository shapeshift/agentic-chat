import type { SwapStepInfo } from '@/hooks/useSwapExecution'
import { SwapStep } from '@/hooks/useSwapExecution'
import { firstFourLastFour } from '@/lib/utils'

import { TxStepCard } from './TxStepCard'

interface SwapData {
  buyAmountCryptoPrecision: string
  buyAmountUsd?: string
  sellAmountCryptoPrecision: string
  buyAsset: {
    symbol: string
  }
  sellAsset: {
    symbol: string
    network: string
  }
}

interface SwapCardHeaderProps {
  address?: string
  swap: SwapData
}

function SwapCardHeader({ address, swap }: SwapCardHeaderProps) {
  return (
    <TxStepCard.Header>
      <TxStepCard.HeaderRow>
        {address && (
          <div className="text-xs text-muted-foreground font-normal">Received from {firstFourLastFour(address)}</div>
        )}
        <div className="text-sm text-muted-foreground font-normal">
          {swap.buyAmountUsd ? `$${swap.buyAmountUsd}` : '$0.00'}
        </div>
      </TxStepCard.HeaderRow>
      <TxStepCard.HeaderRow>
        <TxStepCard.SwapPair
          fromSymbol={swap.sellAsset.symbol.toUpperCase()}
          toSymbol={swap.buyAsset.symbol.toUpperCase()}
        />
        <TxStepCard.Amount>
          +{Number(swap.buyAmountCryptoPrecision).toFixed(6)} {swap.buyAsset.symbol.toUpperCase()}
        </TxStepCard.Amount>
      </TxStepCard.HeaderRow>
    </TxStepCard.Header>
  )
}

interface SwapCardDetailsProps {
  swap: SwapData
  buyAmount: number
  sellAmount: number
  rate: string
}

function SwapCardDetails({ swap, buyAmount, sellAmount, rate }: SwapCardDetailsProps) {
  return (
    <TxStepCard.Content>
      <TxStepCard.Details>
        <TxStepCard.DetailItem
          label="Pair"
          value={`${swap.sellAsset.symbol.toUpperCase()} → ${swap.buyAsset.symbol.toUpperCase()}`}
        />
        <TxStepCard.DetailItem
          label="Buy Amount"
          value={`${buyAmount.toFixed(8)} ${swap.buyAsset.symbol.toUpperCase()}`}
        />
        <TxStepCard.DetailItem
          label="Sell Amount"
          value={`${sellAmount.toFixed(8)} ${swap.sellAsset.symbol.toUpperCase()}`}
        />
        <TxStepCard.DetailItem
          label="Rate"
          value={`1 ${swap.sellAsset.symbol.toUpperCase()} = ${rate} ${swap.buyAsset.symbol.toUpperCase()}`}
        />
        <TxStepCard.DetailItem label="Network Fees" value="—" />
      </TxStepCard.Details>
    </TxStepCard.Content>
  )
}

interface SwapCardStepperProps {
  steps: SwapStepInfo[]
  networkName?: string
  completedCount: number
  footerMessage?: { type: 'error' | 'info'; text: string } | null
}

const getStepText = (step: SwapStepInfo['step'], networkName?: string): string => {
  switch (step) {
    case SwapStep.NETWORK_SWITCH:
      return networkName ? `Switch to ${networkName}` : 'Switch network'
    case SwapStep.APPROVAL:
      return 'Approve token spending'
    case SwapStep.SWAP:
      return 'Sign swap transaction'
    default:
      return 'Unknown step'
  }
}

function SwapCardStepper({ steps, networkName, completedCount, footerMessage }: SwapCardStepperProps) {
  return (
    <TxStepCard.Stepper completedCount={completedCount} totalCount={steps.length}>
      {steps.map((stepInfo, index) => (
        <TxStepCard.Step
          key={stepInfo.step}
          status={stepInfo.status}
          connectorTop={index > 0}
          connectorBottom={index < steps.length - 1}
        >
          {getStepText(stepInfo.step, networkName)}
        </TxStepCard.Step>
      ))}
      {footerMessage && (
        <div
          className={`text-sm font-medium mt-4 ${footerMessage.type === 'error' ? 'text-red-500' : 'text-muted-foreground'}`}
        >
          {footerMessage.text}
        </div>
      )}
    </TxStepCard.Stepper>
  )
}

interface SwapCardProps {
  address?: string
  swap: SwapData
  steps: SwapStepInfo[]
  networkName?: string
  completedCount: number
  footerMessage?: { type: 'error' | 'info'; text: string } | null
}

export function SwapCard({ address, swap, steps, networkName, completedCount, footerMessage }: SwapCardProps) {
  const buyAmount = Number(swap.buyAmountCryptoPrecision)
  const sellAmount = Number(swap.sellAmountCryptoPrecision)
  const rate = buyAmount > 0 && sellAmount > 0 ? (buyAmount / sellAmount).toFixed(6) : '—'

  return (
    <TxStepCard.Root>
      <SwapCardHeader address={address} swap={swap} />
      <SwapCardDetails swap={swap} buyAmount={buyAmount} sellAmount={sellAmount} rate={rate} />
      <SwapCardStepper
        steps={steps}
        networkName={networkName}
        completedCount={completedCount}
        footerMessage={footerMessage}
      />
    </TxStepCard.Root>
  )
}
