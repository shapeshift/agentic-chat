import type { StepState } from '../types/stepState'

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

// Generic getStepStatus that works with any numeric step enum
export function getStepStatus<TStep extends number>(step: TStep, state: StepState<TStep>): StepStatus {
  if (state.failedStep === step) return StepStatus.FAILED
  if (state.currentStep < step) return StepStatus.NOT_STARTED
  if (state.currentStep === step && !state.error) return StepStatus.IN_PROGRESS
  if (state.completedSteps.has(step)) return StepStatus.COMPLETE
  return StepStatus.SKIPPED
}
