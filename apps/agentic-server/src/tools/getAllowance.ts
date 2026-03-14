import type { z } from 'zod'

import type { getAllowanceOutput } from '../utils'
import { getAllowance, getAllowanceInput } from '../utils'

export const getAllowanceSchema = getAllowanceInput
export type GetAllowanceInput = z.infer<typeof getAllowanceInput>
export type GetAllowanceOutput = typeof getAllowanceOutput

export async function executeGetAllowance(input: GetAllowanceInput) {
  return getAllowance(input)
}

export const getAllowanceTool = {
  description: 'Get the token allowance set for a specific spender address',
  inputSchema: getAllowanceSchema,
  execute: executeGetAllowance,
}
