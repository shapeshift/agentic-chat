import type { AssetId } from '@shapeshiftoss/caip'
import type { Asset, PartialRecord } from '@shapeshiftoss/types'
import { create } from 'zustand'

type AssetsState = {
  ids: AssetId[]
  assetsById: PartialRecord<AssetId, Asset>
}

type AssetsActions = {
  upsert: (assets: Asset[]) => void
}

export type AssetsStore = AssetsState & AssetsActions

export const useAssetsStore = create<AssetsStore>(set => ({
  ids: [],
  assetsById: {},
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
