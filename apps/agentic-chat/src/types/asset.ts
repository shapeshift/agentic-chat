import { Asset as FullAsset } from '@shapeshiftoss/types';

// Minimal Asset type definition not to make things more complicated than they need to be for this repo
export type Asset =  Pick<FullAsset, 'assetId' | 'chainId' | 'symbol' | 'name' | 'precision' | 'icon'>
