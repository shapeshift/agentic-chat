import { Parser } from 'expr-eval-fork'
import type { ParserOptions } from 'expr-eval-fork'

export const MAX_EXPRESSION_LENGTH = 1000

// Plain arithmetic only: numbers, named constants/functions, operators, parentheses and commas.
// Excludes `;` (sequencing), `=` (assignment, function definition), brackets (arrays) and quotes (strings).
const ALLOWED_CHARACTERS = /^[0-9A-Za-z_\s.+\-*/^%(),?:<>!]*$/

const DANGEROUS_PATTERNS = [
  /\^[^)]*\d{4,}/, // Exponentials with huge exponents (e.g., 10^10000)
  /\d{1000,}/, // Numbers with 1000+ consecutive digits
]

// `array` is a valid operator option in expr-eval-fork but missing from its typings
const operators: ParserOptions['operators'] & { array: boolean } = {
  assignment: false,
  fndef: false,
  array: false,
  concatenate: false,
  in: false,
  random: false,
}

const parser = new Parser({ allowMemberAccess: false, operators })

// Drop functions that only make sense with arrays, strings or user-defined callbacks
for (const name of ['map', 'fold', 'filter', 'join', 'indexOf', 'random']) {
  delete (parser.functions as Record<string, unknown>)[name]
}

export function validateExpression(expression: string): void {
  if (expression.length > MAX_EXPRESSION_LENGTH) {
    throw new Error(`Expression too long (max ${MAX_EXPRESSION_LENGTH} characters)`)
  }
  if (!ALLOWED_CHARACTERS.test(expression)) {
    throw new Error('Expression contains unsupported characters; only arithmetic is allowed')
  }
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(expression)) {
      throw new Error('Expression contains potentially expensive operations')
    }
  }
}

export function evaluateExpression(expression: string, precision?: number): string {
  validateExpression(expression)

  const rawResult: unknown = parser.evaluate(expression)
  if (typeof rawResult !== 'number' && typeof rawResult !== 'boolean') {
    throw new Error('Expression did not evaluate to a number')
  }

  return precision !== undefined ? Number(rawResult).toFixed(precision) : String(rawResult)
}
