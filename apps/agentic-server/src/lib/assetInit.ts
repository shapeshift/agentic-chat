import { initializeCoinGeckoAdapters } from '@shapeshiftoss/caip'
import { AssetService, initializeRelatedAssetIndex } from '@shapeshiftoss/utils'

export async function initializeAllAssetData(): Promise<void> {
  await Promise.all([AssetService.initialize(), initializeCoinGeckoAdapters(), initializeRelatedAssetIndex()])
}

export async function refreshAllAssetData(): Promise<void> {
  await Promise.all([AssetService.refresh(), initializeCoinGeckoAdapters(), initializeRelatedAssetIndex()])
}
