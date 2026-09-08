import type { WalletContext } from './walletContextSimple'

type WalletTool = {
  description: string
  inputSchema: unknown
  execute: (args: never, walletContext?: WalletContext) => unknown
}

export function wrapTool<T extends WalletTool>(name: string, tool: T, walletContext?: WalletContext) {
  return {
    ...tool,
    execute: (args: Parameters<T['execute']>[0]) => {
      console.log(`[Tool] ${name}:`, JSON.stringify(args, null, 2))
      return tool.execute(args, walletContext)
    },
  }
}

export function wrapTools<T extends Record<string, WalletTool>>(tools: T, walletContext?: WalletContext) {
  return Object.fromEntries(
    Object.entries(tools).map(([name, tool]) => [name, wrapTool(name, tool, walletContext)])
  ) as {
    [K in keyof T]: ReturnType<typeof wrapTool<T[K]>>
  }
}
