import { createStep } from '@mastra/core'
import { getRateOutput } from '@shapeshiftoss/types'
import z from 'zod'

// Example of leveraging an agent within a workflow step.
export const getBestRateStep = createStep({
  id: 'getBestRate',
  inputSchema: z.object({
    getBebopRate: getRateOutput,
    getRelayRate: getRateOutput,
  }),
  outputSchema: getRateOutput,
  execute: async ({ inputData, mastra }) => {
    const prompt = `
      Return the best rate from the following options (NEVER modify the payload, this just passes the best rate through):
      ${JSON.stringify(inputData, null, 2)}
    `

    const agent = mastra.getAgent('shapeshiftAgent')
    if (!agent) throw new Error('ShapeShift Agent not found')

    const { object } = await agent.generate([{ role: 'user', content: prompt }], {
      experimental_output: getRateOutput,
    })

    if (!object) throw new Error('Failed to find the best rate')

    return object
  },
})
