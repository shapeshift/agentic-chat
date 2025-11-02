import { clsx } from 'clsx'
import type { ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const firstFourLastFour = (address: string): string => `${address.slice(0, 6)}...${address.slice(-4)}`
