import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const NetworkEnum = z.enum([
  'avalanche',
  'ethereum',
  'polygon',
  'bsc',
  'optimism',
  'arbitrum',
  'gnosis',
  'base',
]);

export const searchTokens = createTool({
  id: 'searchTokens',
  inputSchema: z.object({
    searchTerm: z.string().describe('The search term to find tokens'),
    network: NetworkEnum.optional().describe('The network to search on'),
  }),
  description: `Search for tokens by name or symbol
    Returns tokens matching the search term, sorted by 7-day USD volume.
    For args parsing, use text proximity to map user input to the correct network.`,
});
