import { Children, createContext, useContext } from 'react'
import type { ReactNode } from 'react'

import type { ToolExecutionState } from '@/lib/executionState'
import { getStepStatus } from '@/lib/executionState'
import { StepStatus, getUserFriendlyError } from '@/lib/stepUtils'
import { useChatStore } from '@/stores/chatStore'

import { TruncateText } from './ui/TruncateText'
import { TxStepCard } from './ui/TxStepCard'

interface ExecutionContextValue {
  state: ToolExecutionState
  toolCallId: string
  isHistorical: boolean
  hasPersisted: boolean
}

const ExecutionCtx = createContext<ExecutionContextValue | null>(null)

function useExecutionContext(): ExecutionContextValue {
  const ctx = useContext(ExecutionCtx)
  if (!ctx) throw new Error('Execution.* components must be used within <Execution.Root>')
  return ctx
}

// --- Root ---
interface RootProps {
  state: ToolExecutionState
  toolCallId: string
  children: ReactNode
}

function Root({ state, toolCallId, children }: RootProps) {
  const { isHistorical, getPersistedTransaction } = useChatStore()
  const hasPersisted = !!getPersistedTransaction(toolCallId)

  return (
    <ExecutionCtx.Provider value={{ state, toolCallId, isHistorical: isHistorical(toolCallId), hasPersisted }}>
      {children}
    </ExecutionCtx.Provider>
  )
}

// --- HistoricalGuard ---
interface HistoricalGuardProps {
  children: ReactNode
  fallbackLabel?: string
}

function HistoricalGuard({ children, fallbackLabel = 'execution' }: HistoricalGuardProps) {
  const { isHistorical, hasPersisted } = useExecutionContext()

  if (isHistorical && !hasPersisted) {
    return (
      <TxStepCard.Root>
        <div className="text-sm text-muted-foreground font-medium p-4">
          {fallbackLabel.charAt(0).toUpperCase() + fallbackLabel.slice(1)} skipped (no saved data)
        </div>
      </TxStepCard.Root>
    )
  }

  return <>{children}</>
}

// --- Stepper ---
interface StepperProps {
  children: ReactNode
}

function Stepper({ children }: StepperProps) {
  const { state } = useExecutionContext()
  const totalCount = Children.count(children)
  const completedCount = state.completedSteps.length + state.skippedSteps.length

  return (
    <TxStepCard.Stepper completedCount={completedCount} totalCount={totalCount}>
      {children}
    </TxStepCard.Stepper>
  )
}

// --- Step ---
interface StepProps {
  index: number
  label: string
  subtitle?: string
  connectorTop?: boolean
  connectorBottom?: boolean
  overrideStatus?: StepStatus
}

function Step({ index, label, subtitle, connectorTop, connectorBottom, overrideStatus }: StepProps) {
  const { state } = useExecutionContext()
  const status = overrideStatus ?? getStepStatus(index, state)
  const activeSubtitle = subtitle ?? (status === StepStatus.IN_PROGRESS ? state.substatus : undefined)

  return (
    <TxStepCard.Step
      status={status}
      subtitle={activeSubtitle}
      connectorTop={connectorTop}
      connectorBottom={connectorBottom}
    >
      {label}
    </TxStepCard.Step>
  )
}

// --- ErrorFooter ---
function ErrorFooter() {
  const { state } = useExecutionContext()
  if (!state.error) return null

  const friendlyError = getUserFriendlyError(state.error)
  return (
    <TruncateText
      text={`Execution failed: ${friendlyError}`}
      limit={80}
      className="text-sm font-medium mt-4 px-4 pb-4 text-red-500"
    />
  )
}

export const Execution = {
  Root,
  HistoricalGuard,
  Stepper,
  Step,
  ErrorFooter,
}
