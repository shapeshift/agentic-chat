import type { CoreMessage, Message } from 'ai'
import cors from 'cors'
import type { Request, Response } from 'express'
import express from 'express'

import { mastra } from './mastra'

type Messages = string | string[] | CoreMessage[] | Message[]

const app = express()
app.use(express.json())
app.use(cors())

app.post('/', async (req: Request, res: Response) => {
  const { messages, userContext } = req.body

  const agent = mastra.getAgent('shapeshiftAgent')

  const result = await agent.stream(messages as Messages, {
    context: [
      {
        role: 'user',
        content: JSON.stringify(userContext),
      },
    ],
    maxSteps: 100,
  })

  result.pipeDataStreamToResponse(res)
})

app.listen(8080, () => {
  console.log(`agentic-server listening on port ${8080}`)
})
