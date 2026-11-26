import z from 'zod'

import { validateExpression } from './mathCalculatorEval'
import type { MathWorkerRequest, MathWorkerResponse } from './mathCalculatorWorker'

const EVALUATION_TIMEOUT_MS = 2000
const MAX_CONCURRENT_EVALUATIONS = 16

// Source runs (bun test / dev) load the .ts worker; the tsup build emits dist/mathCalculatorWorker.js
const WORKER_URL = new URL(
  import.meta.url.endsWith('.ts') ? './mathCalculatorWorker.ts' : './mathCalculatorWorker.js',
  import.meta.url
)

let activeEvaluations = 0

/**
 * Evaluates in a separate worker thread so a slow evaluation cannot block the event loop.
 * The worker is terminated if it does not answer within the time limit.
 */
export function evaluateInWorker(
  expression: string,
  { precision, timeoutMs = EVALUATION_TIMEOUT_MS }: { precision?: number; timeoutMs?: number } = {}
): Promise<string> {
  if (activeEvaluations >= MAX_CONCURRENT_EVALUATIONS) {
    return Promise.reject(new Error('Calculator is busy, try again'))
  }
  activeEvaluations++

  return new Promise<string>((resolve, reject) => {
    const worker = new Worker(WORKER_URL)
    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      worker.terminate()
      activeEvaluations--
      fn()
    }
    const timer = setTimeout(() => finish(() => reject(new Error('Evaluation timed out'))), timeoutMs)

    worker.onmessage = (event: MessageEvent<MathWorkerResponse>) => {
      const response = event.data
      finish(() => (response.ok ? resolve(response.result) : reject(new Error(response.error))))
    }
    worker.onerror = event => finish(() => reject(new Error(event.message || 'Evaluation failed')))

    const request: MathWorkerRequest = { expression, precision }
    worker.postMessage(request)
  })
}

export const mathCalculatorInput = z.object({
  expression: z
    .string()
    .describe(
      'Arithmetic expression to evaluate (e.g., "781573210609912 / (10 ^ 18)"). Supports numbers, + - * / % ^, parentheses and functions like sqrt, abs, min, max, round, floor, ceil, log. No variables, assignments or function definitions.'
    ),
  precision: z.number().optional().describe('Number of decimal places for the result (default: auto)'),
})

export const mathCalculatorOutput = z.object({
  result: z.string().describe('The calculated result as a string'),
  expression: z.string().describe('The original expression'),
})

export type MathCalculatorInput = z.infer<typeof mathCalculatorInput>
export type MathCalculatorOutput = z.infer<typeof mathCalculatorOutput>

export const mathCalculator = {
  description: 'Perform mathematical calculations with high precision',
  inputSchema: mathCalculatorInput,
  execute: async (input: MathCalculatorInput): Promise<MathCalculatorOutput> => {
    const { expression, precision } = input

    try {
      // Cheap checks on the main thread so obviously invalid input never spawns a worker
      validateExpression(expression)

      const result = await evaluateInWorker(expression, { precision })

      console.log('[mathCalculator] result:', { expression, result })

      return {
        result,
        expression,
      }
    } catch (error) {
      console.error('[mathCalculator] error:', { expression, error })
      throw new Error(
        `Failed to evaluate expression "${expression}": ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  },
}
