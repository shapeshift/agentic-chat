#!/usr/bin/env tsx

import fs from 'fs/promises'
import path from 'path'

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/shapeshift/web/develop/src/lib/asset-service/service'

const FILES_TO_DOWNLOAD = [
  'encodedAssetData.json',
  'encodedRelatedAssetIndex.json',
]

const OUTPUT_DIR = path.join(__dirname, '../packages/utils/src/assetData')

async function downloadFile(filename: string): Promise<void> {
  const url = `${GITHUB_RAW_BASE}/${filename}`
  console.log(`Downloading ${filename}...`)

  try {
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.text()
    const outputPath = path.join(OUTPUT_DIR, filename)

    await fs.writeFile(outputPath, data, 'utf-8')

    const sizeKB = (data.length / 1024).toFixed(2)
    console.log(`✓ Downloaded ${filename} (${sizeKB} KB)`)
  } catch (error) {
    console.error(`✗ Failed to download ${filename}:`, error)
    throw error
  }
}

async function main() {
  console.log('Updating asset data from ShapeShift repository...\n')

  await fs.mkdir(OUTPUT_DIR, { recursive: true })

  for (const file of FILES_TO_DOWNLOAD) {
    await downloadFile(file)
  }

  console.log('\n✓ Asset data update complete!')
  console.log(`Files saved to: ${OUTPUT_DIR}`)
}

main().catch((error) => {
  console.error('\n✗ Update failed:', error)
  process.exit(1)
})
