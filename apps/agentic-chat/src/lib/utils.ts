import {
  baseChainId,
  avalancheChainId,
  binanceChainId,
  ChainId,
  arbitrumChainId,
  ethChainId,
  optimismChainId,
  polygonChainId,
} from '@agentic-chat/caip';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const networkToChainIdMap: Record<string, ChainId> = {
  ethereum: ethChainId,
  polygon: polygonChainId,
  arbitrum: arbitrumChainId,
  base: baseChainId,
  avalanche: avalancheChainId,
  optimism: optimismChainId,
  bsc: binanceChainId,
};
