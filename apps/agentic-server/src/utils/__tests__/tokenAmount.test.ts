import { describe, expect, test } from 'bun:test'

import { initiateSwapSchema } from '../../tools/initiateSwap'
import { createLimitOrderSchema } from '../../tools/limitOrder/createLimitOrder'
import { createStopLossSchema } from '../../tools/stopLoss/createStopLoss'
import { createTwapSchema } from '../../tools/twap/createTwap'
import { assertSufficientTokenBalance, getBaseUnitAmountHint, tokenAmountToBaseUnit } from '../tokenAmount'

const usdc = { symbol: 'USDC', precision: 6 }
const weth = { symbol: 'WETH', precision: 18 }

const amountSchemas = {
  swap: initiateSwapSchema.shape.sellAmount,
  limit: createLimitOrderSchema.shape.sellAmount,
  stopLoss: createStopLossSchema.shape.sellAmount,
  twap: createTwapSchema.shape.totalAmount,
}

describe('token amounts', () => {
  for (const [name, schema] of Object.entries(amountSchemas)) {
    test(`${name} rejects malformed, non-positive and exponential amounts`, () => {
      for (const amount of ['1e18', '1e-6', '-1', '+1', '0', '0.00', 'Infinity', 'NaN', '1,000', '1 ETH', '$100', '']) {
        expect(schema.safeParse(amount).success).toBe(false)
      }
      expect(schema.parse(' 0.5 ')).toBe('0.5')
      expect(schema.parse('000000000000001')).toBe('000000000000001')
      expect(schema.parse('1000000000000000')).toBe('1000000000000000')
    })
  }

  test('rejects the USDC and WETH base-unit mistakes with actionable guidance', () => {
    expect(() => assertSufficientTokenBalance('1000000000', usdc, '1000000000')).toThrow('1000 USDC')
    expect(() => assertSufficientTokenBalance('1000000000000000000', weth, '1000000000000000000')).toThrow('1 WETH')
    expect(getBaseUnitAmountHint('1000000000', usdc, '1000000000')).toContain('do not automatically rescale')
  })

  test('accepts large funded amounts without guessing their units', () => {
    expect(() => assertSufficientTokenBalance('1000000000000000', usdc, '1000000000000000000000')).not.toThrow()
    expect(() => assertSufficientTokenBalance('100', weth, '100000000000000000000')).not.toThrow()
    expect(getBaseUnitAmountHint('1000000000000000', usdc, '1000000000000000000000')).toBe('')
  })

  test('preserves precision and rejects amounts that would be rounded', () => {
    expect(tokenAmountToBaseUnit('0.000001', usdc)).toBe('1')
    expect(tokenAmountToBaseUnit('0.000000000000000001', weth)).toBe('1')
    expect(tokenAmountToBaseUnit('000000000000001.0000000', usdc)).toBe('1000000')
    expect(() => tokenAmountToBaseUnit('0.0000001', usdc)).toThrow('6 decimal places')
    expect(() => tokenAmountToBaseUnit('1e18', weth)).toThrow()
  })

  test('does not suggest a conversion when neither interpretation fits the funds', () => {
    expect(() => assertSufficientTokenBalance('1000000000', usdc, '0')).toThrow('Insufficient USDC balance')
    expect(getBaseUnitAmountHint('1000000000', usdc, '0')).toBe('')
    expect(getBaseUnitAmountHint('100', { symbol: 'WHOLE', precision: 0 }, '50')).toBe('')
  })
})
