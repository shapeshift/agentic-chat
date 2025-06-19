import { create } from 'zustand';
import { Asset, PartialRecord } from '@agentic-chat/types';
import { AssetId } from '@agentic-chat/caip';

type AssetsState = {
  ids: AssetId[];
  assetsById: PartialRecord<AssetId, Asset>;
};

type AssetsActions = {
  upsert: (assets: Asset[]) => void;
};

export type AssetsStore = AssetsState & AssetsActions;

export const useAssetsStore = create<AssetsStore>((set) => ({
  ids: [],
  assetsById: {},
  upsert: (assets: Asset[]) => {
    set((state) => {
      const newAssetsById = { ...state.assetsById };
      const newById = [...state.ids];

      assets.forEach((asset) => {
        newAssetsById[asset.assetId] = asset;
        if (!newById.includes(asset.assetId)) {
          newById.push(asset.assetId);
        }
      });

      return {
        ids: newById,
        assetsById: newAssetsById,
      };
    });
  },
}));
