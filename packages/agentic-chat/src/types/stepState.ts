export interface StepState<TStep extends number> {
  currentStep: TStep
  completedSteps: Set<TStep>
  failedStep?: TStep
  error?: string
}
