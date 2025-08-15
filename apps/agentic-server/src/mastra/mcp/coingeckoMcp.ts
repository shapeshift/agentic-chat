import { MCPClient } from '@mastra/mcp'

export const coingeckoMcp = new MCPClient({
  id: 'coingecko-mcp-client',
  servers: {
    coingecko: {
      command: 'npx',
      args: [
        'mcp-remote',
        'https://mcp.pro-api.coingecko.com/sse',
        '--header',
        `x-cg-pro-api-key: ${process.env.COINGECKO_API_KEY}`,
      ],
      enableServerLogs: true,
    },
  },
})
