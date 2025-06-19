import { create } from 'zustand';
import { AssetId } from '@agentic-chat/caip';

type PortfolioState = {
  balances: Record<AssetId, string>;
};

type PortfolioActions = {
  upsert: (balances: Record<AssetId, string>) => void;
};

export type PortfolioStore = PortfolioState & PortfolioActions;

export const usePortfolioStore = create<PortfolioStore>((set) => ({
  balances: {},
  upsert: (balances: Record<AssetId, string>) => {
    set((state) => ({
      balances: { ...state.balances, ...balances },
    }));
  },
}));
