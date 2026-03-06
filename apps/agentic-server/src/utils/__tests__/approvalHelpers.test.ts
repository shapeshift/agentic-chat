import { describe, expect, test } from 'bun:test'
import { decodeFunctionData, erc20Abi, getAddress } from 'viem'

import { buildApprovalTransaction } from '../approvalHelpers'

const MOCK_ASSET = {
  assetId: 'eip155:1/erc20:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  chainId: 'eip155:1',
  name: 'Wrapped Ether',
  precision: 18,
  color: '#627EEA',
  icon: '',
  symbol: 'WETH',
  explorer: 'https://etherscan.io',
  explorerTxLink: 'https://etherscan.io/tx/',
  explorerAddressLink: 'https://etherscan.io/address/',
  relatedAssetKey: null,
}

const MOCK_PEPE = {
  assetId: 'eip155:42161/erc20:0x25d887ce7a35172c62febfd67a1856f20faebb00',
  chainId: 'eip155:42161',
  name: 'Pepe',
  precision: 18,
  color: '#00FF00',
  icon: '',
  symbol: 'PEPE',
  explorer: 'https://arbiscan.io',
  explorerTxLink: 'https://arbiscan.io/tx/',
  explorerAddressLink: 'https://arbiscan.io/address/',
  relatedAssetKey: null,
}

const APPROVAL_TARGET = '0xc92e8bdf79f0507f65a392b0ab4667716bfe0110'
const FROM_ADDRESS = '0xcFD4f9b00935A660283987d8Ec1011c27d8F8fDe'

describe('buildApprovalTransaction', () => {
  test('returns undefined when approval not needed', () => {
    const result = buildApprovalTransaction(
      false,
      MOCK_ASSET as any,
      APPROVAL_TARGET,
      '1000000000000000000',
      FROM_ADDRESS
    )
    expect(result).toBeUndefined()
  })

  test('returns transaction data when approval is needed', () => {
    const result = buildApprovalTransaction(
      true,
      MOCK_ASSET as any,
      APPROVAL_TARGET,
      '1000000000000000000',
      FROM_ADDRESS
    )
    expect(result).toBeDefined()
    expect(result!.from).toBe(FROM_ADDRESS)
    expect(result!.to.toLowerCase()).toBe('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2')
    expect(result!.value).toBe('0')
    expect(result!.chainId).toBe('eip155:1')
  })

  test('encodes correct approval amount in calldata', () => {
    const amount = '1000000000000000000'
    const result = buildApprovalTransaction(true, MOCK_ASSET as any, APPROVAL_TARGET, amount, FROM_ADDRESS)

    const decoded = decodeFunctionData({ abi: erc20Abi, data: result!.data as `0x${string}` })
    expect(decoded.functionName).toBe('approve')
    expect(decoded.args[0]).toBe(getAddress(APPROVAL_TARGET))
    expect(decoded.args[1]).toBe(1000000000000000000n)
  })

  test('handles PEPE-scale amounts (100k tokens = 1e23 base units)', () => {
    const amount = '100000000000000000000000'
    const result = buildApprovalTransaction(true, MOCK_PEPE as any, APPROVAL_TARGET, amount, FROM_ADDRESS)
    expect(result).toBeDefined()

    const decoded = decodeFunctionData({ abi: erc20Abi, data: result!.data as `0x${string}` })
    expect(decoded.args[1]).toBe(100000000000000000000000n)
  })

  test('handles scientific notation strings via toBigInt', () => {
    const amount = '1e+23'
    const result = buildApprovalTransaction(true, MOCK_PEPE as any, APPROVAL_TARGET, amount, FROM_ADDRESS)
    expect(result).toBeDefined()

    const decoded = decodeFunctionData({ abi: erc20Abi, data: result!.data as `0x${string}` })
    expect(decoded.args[1]).toBe(100000000000000000000000n)
  })
})
