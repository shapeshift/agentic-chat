import { Parser } from 'expr-eval'
import z from 'zod'

// Create expr-eval parser instance
const parser = new Parser()

// Safety constants to prevent DoS attacks
const MAX_EXPRESSION_LENGTH = 1000
const DANGEROUS_PATTERNS = [
  /\^[^)]*\d{4,}/, // Exponentials with huge exponents (e.g., 10^10000)
  /\d{1000,}/, // Numbers with 1000+ consecutive digits
]

export const mathCalculatorInput = z.object({
  expression: z.string().describe('Mathematical expression to evaluate (e.g., "781573210609912 / (10 ^ 18)")'),
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
  execute: (input: MathCalculatorInput): MathCalculatorOutput => {
    const { expression, precision } = input

    try {
      // Validate expression safety before evaluation
      if (expression.length > MAX_EXPRESSION_LENGTH) {
        throw new Error(`Expression too long (max ${MAX_EXPRESSION_LENGTH} characters)`)
      }

      // Check for dangerous patterns that could cause DoS
      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(expression)) {
          throw new Error('Expression contains potentially expensive operations')
        }
      }

      // Evaluate the expression using expr-eval
      const rawResult = parser.evaluate(expression)

      // Convert result to string format
      let result: string
      if (precision !== undefined) {
        // Apply specific precision if requested
        result = Number(rawResult).toFixed(precision)
      } else {
        // Use default string representation
        result = String(rawResult)
      }

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
