import type { Dimension, Direction, Metric, TimeUnit } from './fieldTypes'

export type AggregationResult = number | string | Record<string, number | string | Record<string, unknown>>

type BaseAggregationConfig = {
  as?: string
}

type CountConfig = {
  type: 'count'
} & BaseAggregationConfig

type SumConfig = {
  type: 'sum'
  field: Metric
} & BaseAggregationConfig

type AvgConfig = {
  type: 'avg'
  field: Metric
} & BaseAggregationConfig

type MinConfig = {
  type: 'min'
  field: Metric
} & BaseAggregationConfig

type MaxConfig = {
  type: 'max'
  field: Metric
} & BaseAggregationConfig

type GroupByConfig = {
  type: 'groupBy'
  field: Dimension
  aggregations?: AggregationConfig[]
} & BaseAggregationConfig

type GroupByTimeConfig = {
  type: 'groupByTime'
  unit: TimeUnit
  aggregations?: AggregationConfig[]
} & BaseAggregationConfig

type GroupByAssetConfig = {
  type: 'groupByAsset'
  aggregations?: AggregationConfig[]
} & BaseAggregationConfig

type TokenFlowsConfig = {
  type: 'tokenFlows'
  direction?: Direction
} & BaseAggregationConfig

export type AggregationConfig =
  | CountConfig
  | SumConfig
  | AvgConfig
  | MinConfig
  | MaxConfig
  | GroupByConfig
  | GroupByTimeConfig
  | GroupByAssetConfig
  | TokenFlowsConfig
