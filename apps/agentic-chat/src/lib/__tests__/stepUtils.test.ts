import { describe, expect, it } from 'bun:test'

import { createStepPhaseMap, getStepStatus, StepStatus } from '../stepUtils'

enum TestStep {
  FIRST = 0,
  SECOND = 1,
  THIRD = 2,
  COMPLETE = 3,
}

const TEST_PHASES = createStepPhaseMap<TestStep>({
  [TestStep.FIRST]: 'first_done',
  [TestStep.SECOND]: 'second_done',
  [TestStep.THIRD]: 'third_done',
})

describe('createStepPhaseMap', () => {
  describe('toPhases', () => {
    it('serializes completed steps to phase strings', () => {
      const completed = new Set([TestStep.FIRST, TestStep.SECOND])
      const phases = TEST_PHASES.toPhases(completed)
      expect(phases).toContain('first_done')
      expect(phases).toContain('second_done')
      expect(phases).not.toContain('third_done')
    })

    it('returns empty array for empty set', () => {
      expect(TEST_PHASES.toPhases(new Set())).toEqual([])
    })

    it('appends error phase when error string is provided', () => {
      const completed = new Set([TestStep.FIRST])
      const phases = TEST_PHASES.toPhases(completed, 'something broke')
      expect(phases).toContain('first_done')
      expect(phases).toContain('error')
    })

    it('does not append error phase when error is undefined', () => {
      const phases = TEST_PHASES.toPhases(new Set([TestStep.FIRST]))
      expect(phases).not.toContain('error')
    })

    it('filters out steps not in the mapping', () => {
      const completed = new Set([TestStep.COMPLETE])
      const phases = TEST_PHASES.toPhases(completed)
      expect(phases).toEqual([])
    })
  })

  describe('fromPhases', () => {
    it('deserializes phase strings back to step set', () => {
      const steps = TEST_PHASES.fromPhases(['first_done', 'second_done'])
      expect(steps.has(TestStep.FIRST)).toBe(true)
      expect(steps.has(TestStep.SECOND)).toBe(true)
      expect(steps.has(TestStep.THIRD)).toBe(false)
    })

    it('ignores unknown phases', () => {
      const steps = TEST_PHASES.fromPhases(['first_done', 'unknown_phase', 'error'])
      expect(steps.size).toBe(1)
      expect(steps.has(TestStep.FIRST)).toBe(true)
    })

    it('returns empty set for empty array', () => {
      expect(TEST_PHASES.fromPhases([]).size).toBe(0)
    })
  })

  describe('round-trip', () => {
    it('preserves step set through serialization/deserialization', () => {
      const original = new Set([TestStep.FIRST, TestStep.THIRD])
      const phases = TEST_PHASES.toPhases(original)
      const restored = TEST_PHASES.fromPhases(phases)
      expect(restored).toEqual(original)
    })

    it('preserves all steps through round-trip', () => {
      const allSteps = new Set([TestStep.FIRST, TestStep.SECOND, TestStep.THIRD])
      const phases = TEST_PHASES.toPhases(allSteps)
      const restored = TEST_PHASES.fromPhases(phases)
      expect(restored).toEqual(allSteps)
    })

    it('error phase does not pollute step set on deserialization', () => {
      const original = new Set([TestStep.FIRST])
      const phases = TEST_PHASES.toPhases(original, 'oops')
      expect(phases).toContain('error')
      const restored = TEST_PHASES.fromPhases(phases)
      expect(restored).toEqual(original)
    })
  })
})

describe('getStepStatus', () => {
  it('returns FAILED when step matches failedStep', () => {
    const state = {
      currentStep: TestStep.SECOND,
      completedSteps: new Set<TestStep>(),
      failedStep: TestStep.SECOND,
      error: 'something broke',
    }
    expect(getStepStatus(TestStep.SECOND, state)).toBe(StepStatus.FAILED)
  })

  it('returns NOT_STARTED when currentStep is before the queried step', () => {
    const state = {
      currentStep: TestStep.FIRST,
      completedSteps: new Set<TestStep>(),
    }
    expect(getStepStatus(TestStep.THIRD, state)).toBe(StepStatus.NOT_STARTED)
  })

  it('returns IN_PROGRESS when currentStep equals the queried step and no error', () => {
    const state = {
      currentStep: TestStep.SECOND,
      completedSteps: new Set([TestStep.FIRST]),
    }
    expect(getStepStatus(TestStep.SECOND, state)).toBe(StepStatus.IN_PROGRESS)
  })

  it('returns COMPLETE when step is in completedSteps', () => {
    const state = {
      currentStep: TestStep.THIRD,
      completedSteps: new Set([TestStep.FIRST, TestStep.SECOND]),
    }
    expect(getStepStatus(TestStep.FIRST, state)).toBe(StepStatus.COMPLETE)
    expect(getStepStatus(TestStep.SECOND, state)).toBe(StepStatus.COMPLETE)
  })

  it('returns SKIPPED when step is past but not in completedSteps', () => {
    const state = {
      currentStep: TestStep.THIRD,
      completedSteps: new Set([TestStep.FIRST]),
    }
    expect(getStepStatus(TestStep.SECOND, state)).toBe(StepStatus.SKIPPED)
  })

  it('FAILED takes precedence over other statuses', () => {
    const state = {
      currentStep: TestStep.SECOND,
      completedSteps: new Set([TestStep.SECOND]),
      failedStep: TestStep.SECOND,
      error: 'err',
    }
    expect(getStepStatus(TestStep.SECOND, state)).toBe(StepStatus.FAILED)
  })
})
