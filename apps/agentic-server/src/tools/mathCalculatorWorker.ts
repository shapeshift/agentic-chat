import { evaluateExpression } from './mathCalculatorEval'

export type MathWorkerRequest = { expression: string; precision?: number }
export type MathWorkerResponse = { ok: true; result: string } | { ok: false; error: string }

declare const self: Worker

self.onmessage = (event: MessageEvent<MathWorkerRequest>) => {
  let response: MathWorkerResponse
  try {
    response = { ok: true, result: evaluateExpression(event.data.expression, event.data.precision) }
  } catch (error) {
    response = { ok: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
  self.postMessage(response)
}
