import type { useWalletConnection } from '@/hooks/useWalletConnection'

export enum StepStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETE = 'complete',
  SKIPPED = 'skipped',
  FAILED = 'failed',
}

// Create bidirectional mapping from step enum to phase strings
export function createStepPhaseMap<TStep extends number>(mapping: Record<number, string>) {
  const stepToPhase = mapping
  const phaseToStep: Record<string, TStep> = {}
  for (const [step, phase] of Object.entries(mapping)) {
    phaseToStep[phase] = Number(step) as TStep
  }

  return {
    // Serialize: Set<Step> → string[]
    toPhases: (completedSteps: Set<TStep>, error?: string): string[] => [
      ...Array.from(completedSteps)
        .map(s => stepToPhase[s])
        .filter((p): p is string => Boolean(p)),
      ...(error ? ['error'] : []),
    ],
    // Deserialize: string[] → Set<Step>
    fromPhases: (phases: string[]): Set<TStep> =>
      new Set(
        phases
          .filter(p => p in phaseToStep)
          .map(p => phaseToStep[p])
          .filter((s): s is TStep => s !== undefined)
      ),
  }
}

// Generic step state interface - works with any step enum
interface StepState<TStep extends number> {
  currentStep: TStep
  completedSteps: Set<TStep>
  failedStep?: TStep
  error?: string
}

// Generic getStepStatus that works with any numeric step enum
export function getStepStatus<TStep extends number>(step: TStep, state: StepState<TStep>): StepStatus {
  if (state.failedStep === step) return StepStatus.FAILED
  if (state.currentStep < step) return StepStatus.NOT_STARTED
  if (state.currentStep === step && !state.error) return StepStatus.IN_PROGRESS
  if (state.completedSteps.has(step)) return StepStatus.COMPLETE
  return StepStatus.SKIPPED
}

// EIP-712 signing data interface (compatible with CoW Protocol)
// Using generic types to accommodate various EIP-712 structured data formats
interface Eip712SigningData {
  domain: object
  types: object
  primaryType: string
  message: object
}

// Shared EIP-712 signing helper for CoW Protocol operations
export async function signTypedDataWithWallet(
  evmWallet: NonNullable<ReturnType<typeof useWalletConnection>['evmWallet']>,
  signingData: Eip712SigningData
): Promise<string> {
  const walletClient = await evmWallet.getWalletClient()

  // Type assertions needed: viem's signTypedData expects specific EIP-712 type structures
  // that differ from CoW Protocol's API response format
  const signature = await walletClient.signTypedData({
    domain: signingData.domain as Parameters<typeof walletClient.signTypedData>[0]['domain'],
    types: signingData.types as unknown as Parameters<typeof walletClient.signTypedData>[0]['types'],
    primaryType: signingData.primaryType,
    message: signingData.message as unknown as Record<string, unknown>,
  })

  return signature
}
