#!/usr/bin/env tsx

import fs from 'fs/promises'
import path from 'path'

const ASSET_DATA_BASE = 'https://raw.githubusercontent.com/shapeshift/web/develop/src/lib/asset-service/service'
const COINGECKO_MAPPINGS_BASE =
  'https://raw.githubusercontent.com/shapeshift/web/develop/packages/caip/src/adapters/coingecko/generated'

const ASSET_DATA_FILES = ['encodedAssetData.json', 'encodedRelatedAssetIndex.json']

const COINGECKO_CHAINS = [
  'bip122_000000000019d6689c085ae165831e93', // Bitcoin
  'bip122_000000000000000000651ef99cb9fcbe', // Bitcoin Cash
  'bip122_00000000001a91e3dace36e2be3bf030', // Dogecoin
  'bip122_12a765e31ffd4059bada1e25190f6e98', // Litecoin
  'cosmos_cosmoshub-4', // Cosmos Hub
  'cosmos_mayachain-mainnet-v1', // Mayachain
  'cosmos_thorchain-1', // Thorchain
  'eip155_1', // Ethereum
  'eip155_10', // Optimism
  'eip155_100', // Gnosis
  'eip155_137', // Polygon
  'eip155_42161', // Arbitrum
  'eip155_42170', // Arbitrum Nova
  'eip155_43114', // Avalanche
  'eip155_56', // BSC
  'eip155_8453', // Base
  'solana_5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', // Solana
]

async function downloadAssetData() {
  console.log('=== Updating Asset Data ===\n')

  const outputDir = path.join(__dirname, '../packages/utils/src/assetData')
  await fs.mkdir(outputDir, { recursive: true })

  for (const file of ASSET_DATA_FILES) {
    const url = `${ASSET_DATA_BASE}/${file}`
    console.log(`Downloading ${file}...`)

    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.text()
      const outputPath = path.join(outputDir, file)
      await fs.writeFile(outputPath, data, 'utf-8')

      const sizeKB = (data.length / 1024).toFixed(2)
      console.log(`✓ Downloaded ${file} (${sizeKB} KB)`)
    } catch (error) {
      console.error(`✗ Failed to download ${file}:`, error)
      throw error
    }
  }

  console.log(`\n✓ Asset data saved to: ${outputDir}\n`)
}

async function downloadCoinGeckoMappings() {
  console.log('=== Updating CoinGecko Mappings ===\n')

  const outputDir = path.join(__dirname, '../packages/caip/src/adapters/coingecko/generated')
  await fs.mkdir(outputDir, { recursive: true })

  for (const chain of COINGECKO_CHAINS) {
    const url = `${COINGECKO_MAPPINGS_BASE}/${chain}/adapter.json`
    console.log(`Downloading ${chain}...`)

    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.text()
      const chainOutputDir = path.join(outputDir, chain)
      await fs.mkdir(chainOutputDir, { recursive: true })

      const outputPath = path.join(chainOutputDir, 'adapter.json')
      await fs.writeFile(outputPath, data, 'utf-8')

      const sizeKB = (data.length / 1024).toFixed(2)
      console.log(`✓ Downloaded ${chain} (${sizeKB} KB)`)
    } catch (error) {
      console.error(`✗ Failed to download ${chain}:`, error)
      throw error
    }
  }

  console.log(`\n✓ CoinGecko mappings saved to: ${outputDir}\n`)
}

async function main() {
  console.log('Updating assets and CoinGecko mappings from ShapeShift repository...\n')

  try {
    await downloadAssetData()
    await downloadCoinGeckoMappings()

    console.log('✅ All updates complete!')
    console.log('\nNext steps:')
    console.log('1. Run `yarn build` to rebuild packages')
    console.log('2. Commit the updated asset data and mappings')
  } catch (error) {
    console.error('\n✗ Update failed:', error)
    process.exit(1)
  }
}

main()
