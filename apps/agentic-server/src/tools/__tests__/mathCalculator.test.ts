import { describe, expect, test } from 'bun:test'

import { evaluateInWorker, mathCalculator } from '../mathCalculator'

const calc = (expression: string, precision?: number) => mathCalculator.execute({ expression, precision })

const errorOf = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('expected promise to reject')
    },
    (error: unknown) => (error instanceof Error ? error.message : String(error))
  )

// Runs the calculator in a child process so a blocking evaluation cannot hang the test runner.
async function runIsolated(expression: string, deadlineMs: number) {
  const ext = import.meta.url.endsWith('.ts') ? '.ts' : '.js'
  const modulePath = new URL(`../mathCalculator${ext}`, import.meta.url).pathname
  const script = `
    const { mathCalculator } = await import(${JSON.stringify(modulePath)})
    try {
      await mathCalculator.execute({ expression: process.env.EXPR })
      console.log('evaluated')
    } catch {
      console.log('rejected')
    }
  `
  const child = Bun.spawn([process.execPath, '-e', script], {
    env: { ...process.env, EXPR: expression },
    stdout: 'pipe',
    stderr: 'ignore',
  })
  const timer = setTimeout(() => child.kill('SIGKILL'), deadlineMs)
  const start = performance.now()
  await child.exited
  clearTimeout(timer)
  return {
    elapsedMs: performance.now() - start,
    killed: child.signalCode === 'SIGKILL',
    stdout: await new Response(child.stdout).text(),
  }
}

describe('mathCalculator', () => {
  test.each([
    ['781573210609912 / (10 ^ 18)', '0.000781573210609912'],
    ['100 / 2500', '0.04'],
    ['2500 * (1 + 5 / 100)', '2625'],
    ['2500 * (1 - 10 / 100)', '2250'],
    ['(1.5 + 2.25) * 4 - 3 % 2', '14'],
    ['sqrt(16) + abs(-2) + min(3, 4) + max(1, 2)', '11'],
    ['round(2.6) + floor(2.6) + ceil(2.1)', '8'],
    ['2 ^ 10', '1024'],
    ['-5 + 3', '-2'],
    ['1e18 / 1e9', '1000000000'],
    ['PI > 3 ? 1 : 0', '1'],
  ])('evaluates %s', async (expression, expected) => {
    const { result } = await calc(expression)
    expect(result).toBe(expected)
  })

  test('applies precision', async () => {
    expect((await calc('1 / 3', 4)).result).toBe('0.3333')
  })

  test.each([
    ['f(n) = n', 'function definition'],
    ['x = 1', 'assignment'],
    ['1; 2', 'statement sequence'],
    ['[1, 2, 3]', 'array literal'],
    ['"a" || "b"', 'string concatenation'],
    ['map(abs, 1)', 'higher-order function'],
    ['1 == 1', 'equals sign'],
    ['a + 1', 'unknown variable'],
  ])('rejects %s (%s)', async expression => {
    expect(await errorOf(calc(expression))).toContain('Failed to evaluate')
  })

  test('rejects over-long expressions', async () => {
    expect(await errorOf(calc('1+'.repeat(600) + '1'))).toContain('too long')
  })

  test('rejects function definitions in an isolated process', async () => {
    const expression = 'g(x) = x + 1; g(1)'
    const { elapsedMs, killed, stdout } = await runIsolated(expression, 10_000)
    expect(killed).toBe(false)
    expect(stdout.trim()).toBe('rejected')
    expect(elapsedMs).toBeLessThan(10_000)
  }, 15_000)

  test('kills an evaluation that exceeds the time limit', async () => {
    expect(await errorOf(evaluateInWorker('1 + 1', { timeoutMs: 0 }))).toContain('timed out')
  })
})
