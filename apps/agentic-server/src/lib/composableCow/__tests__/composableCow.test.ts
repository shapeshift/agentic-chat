import { describe, expect, test } from 'bun:test'
import { encodeAbiParameters, keccak256, parseAbiParameters } from 'viem'

import { toChecksumAddress } from '../../../utils/addressValidation'
import {
  COMPOSABLE_COW_ADDRESS,
  COW_SETTLEMENT_ADDRESS,
  COW_VAULT_RELAYER_ADDRESS,
  CURRENT_BLOCK_TIMESTAMP_FACTORY,
  STOP_LOSS_HANDLER_ADDRESS,
  TWAP_HANDLER_ADDRESS,
  buildCreateConditionalOrderTx,
  buildRemoveConditionalOrderTx,
  computeConditionalOrderHash,
  decodeStopLossStaticData,
  encodeStopLossStaticData,
  encodeTwapStaticData,
  generateOrderSalt,
} from '../index'
import type { ConditionalOrderParams } from '../index'

import {
  ADDRESSES,
  DETERMINISTIC_SALT,
  FUNCTION_SELECTORS,
  STOP_LOSS_FIXTURE,
  TWAP_FIXTURE,
  createStopLossData,
} from './fixtures'

// Pre-computed known-good hash for the regression test (tuple encoding, matching Solidity abi.encode(struct))
const KNOWN_TUPLE_HASH = '0x1d3a829d5e9f37406d0c7f7e1733c643d5a9578f811e659d97e0def76e313c44'
const KNOWN_FLAT_HASH = '0xfb7932536524b6abbd194805612ea524f8cb16745d1f2519f10516d15a7a9da3'

function buildTestConditionalOrderParams(): ConditionalOrderParams {
  return {
    handler: STOP_LOSS_HANDLER_ADDRESS,
    salt: DETERMINISTIC_SALT,
    staticInput: encodeStopLossStaticData(STOP_LOSS_FIXTURE),
  }
}

describe('composableCow', () => {
  describe('encodeStopLossStaticData', () => {
    test('should return a hex string starting with 0x', () => {
      const encoded = encodeStopLossStaticData(STOP_LOSS_FIXTURE)
      expect(encoded).toMatch(/^0x[0-9a-f]+$/i)
    })

    test('should produce deterministic output for the same input', () => {
      const first = encodeStopLossStaticData(STOP_LOSS_FIXTURE)
      const second = encodeStopLossStaticData(STOP_LOSS_FIXTURE)
      expect(first).toBe(second)
    })

    test('should produce different output when a field changes', () => {
      const original = encodeStopLossStaticData(STOP_LOSS_FIXTURE)
      const modified = encodeStopLossStaticData(createStopLossData({ sellAmount: 2000000000000000000n }))
      expect(original).not.toBe(modified)
    })
  })

  describe('decodeStopLossStaticData', () => {
    test('should roundtrip encode then decode preserving all 13 fields', () => {
      const encoded = encodeStopLossStaticData(STOP_LOSS_FIXTURE)
      const decoded = decodeStopLossStaticData(encoded)

      expect(decoded.sellToken).toBe(STOP_LOSS_FIXTURE.sellToken)
      expect(decoded.buyToken).toBe(STOP_LOSS_FIXTURE.buyToken)
      expect(decoded.sellAmount).toBe(STOP_LOSS_FIXTURE.sellAmount)
      expect(decoded.buyAmount).toBe(STOP_LOSS_FIXTURE.buyAmount)
      expect(decoded.appData).toBe(STOP_LOSS_FIXTURE.appData)
      expect(decoded.receiver).toBe(STOP_LOSS_FIXTURE.receiver)
      expect(decoded.isSellOrder).toBe(STOP_LOSS_FIXTURE.isSellOrder)
      expect(decoded.isPartiallyFillable).toBe(STOP_LOSS_FIXTURE.isPartiallyFillable)
      expect(decoded.validTo).toBe(STOP_LOSS_FIXTURE.validTo)
      expect(decoded.sellTokenPriceOracle).toBe(STOP_LOSS_FIXTURE.sellTokenPriceOracle)
      expect(decoded.buyTokenPriceOracle).toBe(STOP_LOSS_FIXTURE.buyTokenPriceOracle)
      expect(decoded.strike).toBe(STOP_LOSS_FIXTURE.strike)
      expect(decoded.maxTimeSinceLastOracleUpdate).toBe(STOP_LOSS_FIXTURE.maxTimeSinceLastOracleUpdate)
    })

    test('should preserve address checksumming through roundtrip', () => {
      const encoded = encodeStopLossStaticData(STOP_LOSS_FIXTURE)
      const decoded = decodeStopLossStaticData(encoded)

      expect(decoded.sellToken).toBe(toChecksumAddress(decoded.sellToken))
      expect(decoded.buyToken).toBe(toChecksumAddress(decoded.buyToken))
      expect(decoded.receiver).toBe(toChecksumAddress(decoded.receiver))
      expect(decoded.sellTokenPriceOracle).toBe(toChecksumAddress(decoded.sellTokenPriceOracle))
      expect(decoded.buyTokenPriceOracle).toBe(toChecksumAddress(decoded.buyTokenPriceOracle))
    })
  })

  describe('encodeTwapStaticData', () => {
    test('should return a hex string starting with 0x', () => {
      const encoded = encodeTwapStaticData(TWAP_FIXTURE)
      expect(encoded).toMatch(/^0x[0-9a-f]+$/i)
    })

    test('should produce deterministic output for the same input', () => {
      const first = encodeTwapStaticData(TWAP_FIXTURE)
      const second = encodeTwapStaticData(TWAP_FIXTURE)
      expect(first).toBe(second)
    })
  })

  describe('generateOrderSalt', () => {
    test('should return a bytes32 hex string (66 chars)', () => {
      const salt = generateOrderSalt(ADDRESSES.SAFE, ADDRESSES.WETH, ADDRESSES.USDC, 1)
      expect(salt).toMatch(/^0x[0-9a-f]{64}$/)
      expect(salt.length).toBe(66)
    })

    test('should produce unique salts even with same nonce due to randomness', () => {
      const first = generateOrderSalt(ADDRESSES.SAFE, ADDRESSES.WETH, ADDRESSES.USDC, 42)
      const second = generateOrderSalt(ADDRESSES.SAFE, ADDRESSES.WETH, ADDRESSES.USDC, 42)
      expect(first).not.toBe(second)
    })

    test('should produce different output for different nonce', () => {
      const first = generateOrderSalt(ADDRESSES.SAFE, ADDRESSES.WETH, ADDRESSES.USDC, 1)
      const second = generateOrderSalt(ADDRESSES.SAFE, ADDRESSES.WETH, ADDRESSES.USDC, 2)
      expect(first).not.toBe(second)
    })

    test('should produce different output for reversed token pair', () => {
      const forward = generateOrderSalt(ADDRESSES.SAFE, ADDRESSES.WETH, ADDRESSES.USDC, 1)
      const reversed = generateOrderSalt(ADDRESSES.SAFE, ADDRESSES.USDC, ADDRESSES.WETH, 1)
      expect(forward).not.toBe(reversed)
    })
  })

  describe('buildCreateConditionalOrderTx', () => {
    const params = buildTestConditionalOrderParams()

    test('without factory should use create selector', () => {
      const tx = buildCreateConditionalOrderTx(params)
      expect(tx.to).toBe(COMPOSABLE_COW_ADDRESS)
      expect(tx.value).toBe('0')
      expect(tx.data.startsWith(FUNCTION_SELECTORS.create)).toBe(true)
    })

    test('with factory should use createWithContext selector', () => {
      const tx = buildCreateConditionalOrderTx(params, { factory: CURRENT_BLOCK_TIMESTAMP_FACTORY })
      expect(tx.to).toBe(COMPOSABLE_COW_ADDRESS)
      expect(tx.value).toBe('0')
      expect(tx.data.startsWith(FUNCTION_SELECTORS.createWithContext)).toBe(true)
    })
  })

  describe('buildRemoveConditionalOrderTx', () => {
    const orderHash = '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`
    const tx = buildRemoveConditionalOrderTx(orderHash)

    test('should set to to COMPOSABLE_COW_ADDRESS', () => {
      expect(tx.to).toBe(COMPOSABLE_COW_ADDRESS)
    })

    test('should set value to 0', () => {
      expect(tx.value).toBe('0')
    })

    test('should encode data with the remove function selector', () => {
      expect(tx.data.startsWith(FUNCTION_SELECTORS.remove)).toBe(true)
    })
  })

  describe('computeConditionalOrderHash', () => {
    const params = buildTestConditionalOrderParams()

    test('should return a bytes32 hex string', () => {
      const hash = computeConditionalOrderHash(params)
      expect(hash).toMatch(/^0x[0-9a-f]{64}$/)
    })

    test('should be deterministic for the same input', () => {
      const first = computeConditionalOrderHash(params)
      const second = computeConditionalOrderHash(params)
      expect(first).toBe(second)
    })

    test('should use tuple encoding matching Solidity abi.encode(struct)', () => {
      const hash = computeConditionalOrderHash(params)
      expect(hash).toBe(KNOWN_TUPLE_HASH)
    })

    test('should NOT match flat parameter encoding (regression for tuple encoding bug)', () => {
      const hash = computeConditionalOrderHash(params)
      const flatHash = keccak256(
        encodeAbiParameters(parseAbiParameters('address, bytes32, bytes'), [
          params.handler,
          params.salt,
          params.staticInput,
        ])
      )
      expect(flatHash).toBe(KNOWN_FLAT_HASH)
      expect(hash).not.toBe(flatHash)
    })
  })

  describe('exported constants', () => {
    test('all address constants should be valid checksummed addresses', () => {
      const addresses = [
        COMPOSABLE_COW_ADDRESS,
        STOP_LOSS_HANDLER_ADDRESS,
        TWAP_HANDLER_ADDRESS,
        COW_SETTLEMENT_ADDRESS,
        COW_VAULT_RELAYER_ADDRESS,
      ]

      for (const address of addresses) {
        expect(address).toBe(toChecksumAddress(address))
      }
    })
  })
})
