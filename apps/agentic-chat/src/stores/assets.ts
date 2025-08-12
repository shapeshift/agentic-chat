import type { AssetId } from '@shapeshiftoss/caip'
import type { Asset } from '@shapeshiftoss/types'
import { create } from 'zustand'

import type { PartialRecord } from '@/types'

import { initialAssets } from './constants'

type AssetsState = {
  ids: AssetId[]
  assetsById: PartialRecord<AssetId, Asset>
}

type AssetsActions = {
  upsert: (assets: Asset[]) => void
}

export type AssetsStore = AssetsState & AssetsActions

export const useAssetsStore = create<AssetsStore>(set => ({
  ids: Object.keys(initialAssets),
  assetsById: initialAssets,
  upsert: (assets: Asset[]) => {
    set(state => {
      const newAssetsById: PartialRecord<AssetId, Asset> = { ...state.assetsById }
      const newById = [...state.ids]

      assets.forEach(asset => {
        newAssetsById[asset.assetId] = asset
        if (!newById.includes(asset.assetId)) {
          newById.push(asset.assetId)
        }
      })

      return {
        ids: newById,
        assetsById: newAssetsById,
      }
    })
  },
}))
