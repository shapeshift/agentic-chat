import { describe, expect, test } from 'bun:test'

import { downsample } from '../downsample'

describe('downsample', () => {
  const tenPoints: [number, number][] = [
    [1000, 100],
    [2000, 110],
    [3000, 105],
    [4000, 120],
    [5000, 115],
    [6000, 130],
    [7000, 125],
    [8000, 140],
    [9000, 135],
    [10000, 150],
  ]

  test('returns evenly spaced points', () => {
    const result = downsample(tenPoints, 3)
    expect(result).toHaveLength(3)
    // first, middle, last
    expect(result[0]).toEqual([1000, 100])
    expect(result[2]).toEqual([10000, 150])
  })

  test('returns all points when dataPoints >= array length', () => {
    const result = downsample(tenPoints, 10)
    expect(result).toHaveLength(10)
    expect(result).toEqual(tenPoints)
  })

  test('returns all points when dataPoints > array length', () => {
    const result = downsample(tenPoints, 20)
    expect(result).toHaveLength(10)
    expect(result).toEqual(tenPoints)
  })

  test('returns single point (last) when dataPoints is 1', () => {
    const result = downsample(tenPoints, 1)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual([10000, 150])
  })

  test('returns first and last when dataPoints is 2', () => {
    const result = downsample(tenPoints, 2)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual([1000, 100])
    expect(result[1]).toEqual([10000, 150])
  })

  test('returns empty array for empty input', () => {
    expect(downsample([], 5)).toEqual([])
  })

  test('returns single element for single element input', () => {
    const result = downsample([[1000, 100]], 5)
    expect(result).toEqual([[1000, 100]])
  })
})
