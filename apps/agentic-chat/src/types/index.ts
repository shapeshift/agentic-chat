export type { Conversation } from '@shapeshiftoss/chat'
export * from './message'
export * from './quote'
export * from './transaction'
export * from './wallet'

export type PartialRecord<K extends PropertyKey, V> = Partial<Record<K, V>>
