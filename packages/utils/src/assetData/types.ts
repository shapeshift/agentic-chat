import type { FIELDS } from './constants'

export type Field = (typeof FIELDS)[number]

export type FieldToType = {
  assetIdx: number
  name: string
  precision: number
  color: string
  icon: string[]
  symbol: string
  isPool: 0 | 1
}

export type EncodedAsset = [
  FieldToType['assetIdx'],
  FieldToType['name'],
  FieldToType['precision'],
  FieldToType['color'],
  FieldToType['icon'],
  FieldToType['symbol'],
  FieldToType['isPool'],
]

export type EncodedAssetData = {
  assetIdPrefixes: string[]
  encodedAssetIds: string[]
  encodedAssets: EncodedAsset[]
}
