import path from 'path'

import { Database } from 'bun:sqlite'

export type StopLossStatus = 'pending' | 'triggered' | 'submitted' | 'filled' | 'cancelled' | 'failed' | 'expired'

export interface StopLossOrder {
  id: string
  ownerAddress: string
  chainId: number
  sellToken: string
  buyToken: string
  sellAmount: string
  buyAmount: string
  validTo: number
  triggerPrice: string
  currentPriceAtCreation: string
  sellTokenCoingeckoId: string
  sellTokenSymbol: string
  buyTokenSymbol: string
  sellAmountHuman: string
  network: string
  signature: string
  orderPayload: string
  status: StopLossStatus
  cowOrderId: string | null
  createdAt: string
  updatedAt: string
  triggeredAt: string | null
  errorMessage: string | null
  appData: string
  receiver: string
  expiresAt: string
}

let db: Database | null = null

export function getStopLossDb(): Database {
  if (db) return db

  const dbPath = process.env.STOP_LOSS_DB_PATH || path.join(process.cwd(), 'data', 'stop-loss.db')

  // Ensure directory exists
  const dir = path.dirname(dbPath)
  Bun.spawnSync(['mkdir', '-p', dir])

  db = new Database(dbPath, { create: true })
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec('PRAGMA foreign_keys = ON;')

  db.exec(`
    CREATE TABLE IF NOT EXISTS stop_loss_orders (
      id TEXT PRIMARY KEY,
      ownerAddress TEXT NOT NULL,
      chainId INTEGER NOT NULL,
      sellToken TEXT NOT NULL,
      buyToken TEXT NOT NULL,
      sellAmount TEXT NOT NULL,
      buyAmount TEXT NOT NULL,
      validTo INTEGER NOT NULL,
      triggerPrice TEXT NOT NULL,
      currentPriceAtCreation TEXT NOT NULL,
      sellTokenCoingeckoId TEXT NOT NULL,
      sellTokenSymbol TEXT NOT NULL,
      buyTokenSymbol TEXT NOT NULL,
      sellAmountHuman TEXT NOT NULL,
      network TEXT NOT NULL,
      signature TEXT NOT NULL,
      orderPayload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      cowOrderId TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      triggeredAt TEXT,
      errorMessage TEXT,
      appData TEXT NOT NULL,
      receiver TEXT NOT NULL,
      expiresAt TEXT NOT NULL
    );
  `)

  db.exec('CREATE INDEX IF NOT EXISTS idx_stop_loss_owner ON stop_loss_orders(ownerAddress);')
  db.exec('CREATE INDEX IF NOT EXISTS idx_stop_loss_status ON stop_loss_orders(status);')

  console.log(`[StopLoss DB] Initialized at ${dbPath}`)
  return db
}

export function insertStopLossOrder(order: StopLossOrder): void {
  const database = getStopLossDb()
  const stmt = database.prepare(`
    INSERT INTO stop_loss_orders (
      id, ownerAddress, chainId, sellToken, buyToken, sellAmount, buyAmount, validTo,
      triggerPrice, currentPriceAtCreation, sellTokenCoingeckoId, sellTokenSymbol, buyTokenSymbol,
      sellAmountHuman, network, signature, orderPayload, status, cowOrderId,
      createdAt, updatedAt, triggeredAt, errorMessage, appData, receiver, expiresAt
    ) VALUES (
      $id, $ownerAddress, $chainId, $sellToken, $buyToken, $sellAmount, $buyAmount, $validTo,
      $triggerPrice, $currentPriceAtCreation, $sellTokenCoingeckoId, $sellTokenSymbol, $buyTokenSymbol,
      $sellAmountHuman, $network, $signature, $orderPayload, $status, $cowOrderId,
      $createdAt, $updatedAt, $triggeredAt, $errorMessage, $appData, $receiver, $expiresAt
    )
  `)
  stmt.run({
    $id: order.id,
    $ownerAddress: order.ownerAddress,
    $chainId: order.chainId,
    $sellToken: order.sellToken,
    $buyToken: order.buyToken,
    $sellAmount: order.sellAmount,
    $buyAmount: order.buyAmount,
    $validTo: order.validTo,
    $triggerPrice: order.triggerPrice,
    $currentPriceAtCreation: order.currentPriceAtCreation,
    $sellTokenCoingeckoId: order.sellTokenCoingeckoId,
    $sellTokenSymbol: order.sellTokenSymbol,
    $buyTokenSymbol: order.buyTokenSymbol,
    $sellAmountHuman: order.sellAmountHuman,
    $network: order.network,
    $signature: order.signature,
    $orderPayload: order.orderPayload,
    $status: order.status,
    $cowOrderId: order.cowOrderId,
    $createdAt: order.createdAt,
    $updatedAt: order.updatedAt,
    $triggeredAt: order.triggeredAt,
    $errorMessage: order.errorMessage,
    $appData: order.appData,
    $receiver: order.receiver,
    $expiresAt: order.expiresAt,
  })
}

export function getStopLossOrdersByOwner(
  ownerAddress: string,
  options?: { status?: StopLossStatus; chainId?: number }
): StopLossOrder[] {
  const database = getStopLossDb()
  const conditions = ['ownerAddress = $ownerAddress']
  const params: Record<string, string | number> = { $ownerAddress: ownerAddress.toLowerCase() }

  if (options?.status) {
    conditions.push('status = $status')
    params.$status = options.status
  }
  if (options?.chainId) {
    conditions.push('chainId = $chainId')
    params.$chainId = options.chainId
  }

  const query = `SELECT * FROM stop_loss_orders WHERE ${conditions.join(' AND ')} ORDER BY createdAt DESC`
  return database.prepare(query).all(params) as StopLossOrder[]
}

export function getPendingStopLossOrders(): StopLossOrder[] {
  const database = getStopLossDb()
  return database.prepare("SELECT * FROM stop_loss_orders WHERE status = 'pending'").all() as StopLossOrder[]
}

export function updateStopLossStatus(
  id: string,
  status: StopLossStatus,
  extra?: { cowOrderId?: string; errorMessage?: string; triggeredAt?: string }
): void {
  const database = getStopLossDb()
  const now = new Date().toISOString()
  database
    .prepare(
      `UPDATE stop_loss_orders
       SET status = $status, updatedAt = $updatedAt,
           cowOrderId = COALESCE($cowOrderId, cowOrderId),
           errorMessage = COALESCE($errorMessage, errorMessage),
           triggeredAt = COALESCE($triggeredAt, triggeredAt)
       WHERE id = $id`
    )
    .run({
      $id: id,
      $status: status,
      $updatedAt: now,
      $cowOrderId: extra?.cowOrderId ?? null,
      $errorMessage: extra?.errorMessage ?? null,
      $triggeredAt: extra?.triggeredAt ?? null,
    })
}

export function deleteStopLossOrder(id: string): boolean {
  const database = getStopLossDb()
  const result = database.prepare("DELETE FROM stop_loss_orders WHERE id = $id AND status = 'pending'").run({ $id: id })
  return result.changes > 0
}

export function expireStaleOrders(): number {
  const database = getStopLossDb()
  const now = new Date().toISOString()
  const result = database
    .prepare(
      `UPDATE stop_loss_orders
       SET status = 'expired', updatedAt = $now
       WHERE status = 'pending' AND expiresAt < $now`
    )
    .run({ $now: now })
  return result.changes
}

export function getStopLossOrderById(id: string): StopLossOrder | null {
  const database = getStopLossDb()
  return (database.prepare('SELECT * FROM stop_loss_orders WHERE id = $id').get({ $id: id }) as StopLossOrder) ?? null
}
