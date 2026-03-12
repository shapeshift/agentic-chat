import { describe, expect, it } from 'bun:test'

import type { ToolExecutionState } from '../executionState'
import { advanceStep, failStep, getStepStatus, markTerminal, skipStep, toolStateToStepStatus } from '../executionState'
import { StepStatus } from '../stepUtils'

function makeState(overrides: Partial<ToolExecutionState> = {}): ToolExecutionState {
  return {
    toolCallId: 'tc-1',
    toolName: 'initiateSwapTool',
    conversationId: 'conv-1',
    timestamp: 1000,
    currentStep: 0,
    completedSteps: [],
    skippedSteps: [],
    terminal: false,
    meta: {},
    ...overrides,
  }
}

describe('advanceStep', () => {
  it('marks current step complete and increments', () => {
    const state = makeState({ currentStep: 1 })
    const next = advanceStep(state)
    expect(next.completedSteps).toContain(1)
    expect(next.currentStep).toBe(2)
  })

  it('does not duplicate completed steps', () => {
    const state = makeState({ currentStep: 1, completedSteps: [0, 1] })
    const next = advanceStep(state)
    expect(next.completedSteps.filter(s => s === 1)).toHaveLength(1)
  })
})

describe('failStep', () => {
  it('sets failedStep, error, and terminal', () => {
    const state = makeState({ currentStep: 2 })
    const next = failStep(state, 'something broke')
    expect(next.failedStep).toBe(2)
    expect(next.error).toBe('something broke')
    expect(next.terminal).toBe(true)
  })
})

describe('skipStep', () => {
  it('adds step to skippedSteps and advances', () => {
    const state = makeState({ currentStep: 1 })
    const next = skipStep(state)
    expect(next.skippedSteps).toContain(1)
    expect(next.currentStep).toBe(2)
  })
})

describe('markTerminal', () => {
  it('sets terminal to true', () => {
    const state = makeState()
    const next = markTerminal(state)
    expect(next.terminal).toBe(true)
  })
})

describe('getStepStatus (number[] version)', () => {
  it('returns FAILED when step matches failedStep', () => {
    const state = makeState({ currentStep: 2, failedStep: 2, error: 'err' })
    expect(getStepStatus(2, state)).toBe(StepStatus.FAILED)
  })

  it('returns NOT_STARTED when currentStep is before the queried step', () => {
    const state = makeState({ currentStep: 0 })
    expect(getStepStatus(2, state)).toBe(StepStatus.NOT_STARTED)
  })

  it('returns IN_PROGRESS when currentStep equals step and no error', () => {
    const state = makeState({ currentStep: 1, completedSteps: [0] })
    expect(getStepStatus(1, state)).toBe(StepStatus.IN_PROGRESS)
  })

  it('returns COMPLETE when step is in completedSteps', () => {
    const state = makeState({ currentStep: 2, completedSteps: [0, 1] })
    expect(getStepStatus(0, state)).toBe(StepStatus.COMPLETE)
    expect(getStepStatus(1, state)).toBe(StepStatus.COMPLETE)
  })

  it('returns SKIPPED when step is in skippedSteps', () => {
    const state = makeState({ currentStep: 2, skippedSteps: [1] })
    expect(getStepStatus(1, state)).toBe(StepStatus.SKIPPED)
  })

  it('returns SKIPPED when step is past but not in completedSteps or skippedSteps', () => {
    const state = makeState({ currentStep: 3, completedSteps: [0] })
    expect(getStepStatus(1, state)).toBe(StepStatus.SKIPPED)
  })

  it('FAILED takes precedence over COMPLETE', () => {
    const state = makeState({ currentStep: 2, completedSteps: [2], failedStep: 2, error: 'err' })
    expect(getStepStatus(2, state)).toBe(StepStatus.FAILED)
  })
})

describe('getStepStatus edge cases', () => {
  it('returns SKIPPED for step in skippedSteps even if past', () => {
    const state = makeState({ currentStep: 3, skippedSteps: [1], completedSteps: [0, 2] })
    expect(getStepStatus(1, state)).toBe(StepStatus.SKIPPED)
  })

  it('handles empty completedSteps and skippedSteps', () => {
    const state = makeState({ currentStep: 0 })
    expect(getStepStatus(0, state)).toBe(StepStatus.IN_PROGRESS)
    expect(getStepStatus(1, state)).toBe(StepStatus.NOT_STARTED)
  })

  it('handles terminal state with error', () => {
    const state = makeState({ currentStep: 2, failedStep: 2, error: 'fail', terminal: true, completedSteps: [0, 1] })
    expect(getStepStatus(0, state)).toBe(StepStatus.COMPLETE)
    expect(getStepStatus(1, state)).toBe(StepStatus.COMPLETE)
    expect(getStepStatus(2, state)).toBe(StepStatus.FAILED)
    expect(getStepStatus(3, state)).toBe(StepStatus.NOT_STARTED)
  })
})

describe('toolStateToStepStatus', () => {
  it('returns FAILED for output-error', () => {
    expect(toolStateToStepStatus('output-error')).toBe(StepStatus.FAILED)
  })

  it('returns IN_PROGRESS for input-streaming', () => {
    expect(toolStateToStepStatus('input-streaming')).toBe(StepStatus.IN_PROGRESS)
  })

  it('returns IN_PROGRESS for input-available', () => {
    expect(toolStateToStepStatus('input-available')).toBe(StepStatus.IN_PROGRESS)
  })

  it('returns COMPLETE for output-available', () => {
    expect(toolStateToStepStatus('output-available')).toBe(StepStatus.COMPLETE)
  })

  it('returns NOT_STARTED for unknown states', () => {
    expect(toolStateToStepStatus('something-else')).toBe(StepStatus.NOT_STARTED)
  })
})
