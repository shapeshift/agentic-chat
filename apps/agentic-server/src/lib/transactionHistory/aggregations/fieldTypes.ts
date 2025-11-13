// Metrics - numeric fields that can be aggregated (sum, avg, min, max)
export const METRICS = ['usdValueSent', 'usdValueReceived', 'usdFee', 'timestamp', 'blockHeight'] as const
export type Metric = (typeof METRICS)[number]

// Summable metrics - subset for sum/avg operations (timestamp/blockHeight don't make sense to sum)
export const SUMMABLE_METRICS = ['usdValueSent', 'usdValueReceived', 'usdFee'] as const
export type SummableMetric = (typeof SUMMABLE_METRICS)[number]

// Dimensions - categorical fields that can be grouped by
export const DIMENSIONS = ['type', 'status'] as const
export type Dimension = (typeof DIMENSIONS)[number]

// Time units for time-based grouping
export const TIME_UNITS = ['hour', 'day', 'week', 'month'] as const
export type TimeUnit = (typeof TIME_UNITS)[number]

// Directions for token flow calculations
export const DIRECTIONS = ['in', 'out', 'net'] as const
export type Direction = (typeof DIRECTIONS)[number]
