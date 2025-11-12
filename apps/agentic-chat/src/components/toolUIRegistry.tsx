import type { DynamicToolUIPart } from 'ai'
import type { ComponentType } from 'react'

import { GetAccountUI } from './tools/GetAccountUI'
import { GetAllowanceUI } from './tools/GetAllowanceUI'
import { GetAssetsUI } from './tools/GetAssetsUI'
import { GetTransactionHistoryUI } from './tools/GetTransactionHistoryUI'
import { InitiateSwapUI } from './tools/InitiateSwapUI'
import { PortfolioUI } from './tools/PortfolioUI'
import { SendUI } from './tools/SendUI'
import { SwitchNetworkUI } from './tools/SwitchNetworkUI'

interface ToolUIProps {
  toolPart: DynamicToolUIPart
}

type ToolUIComponent = ComponentType<ToolUIProps>

export const TOOL_UI_REGISTRY: Record<string, ToolUIComponent> = {
  initiateSwapTool: InitiateSwapUI,
  initiateSwapUsdTool: InitiateSwapUI,
  switchNetworkTool: SwitchNetworkUI,
  portfolioTool: PortfolioUI,
  getAssetsTool: GetAssetsUI,
  getAccountTool: GetAccountUI,
  getTransactionHistoryTool: GetTransactionHistoryUI,
  getAllowanceTool: GetAllowanceUI,
  sendTool: SendUI,
} as const

export function getToolUIComponent(toolName: string): ToolUIComponent | undefined {
  return TOOL_UI_REGISTRY[toolName]
}
