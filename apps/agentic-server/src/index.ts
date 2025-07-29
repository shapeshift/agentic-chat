import { approveStep, mastra } from '@shapeshiftoss/mastra'
import type { CoreMessage, Message } from 'ai'
import cors from 'cors'
import type { Request, Response } from 'express'
import express from 'express'

type Messages = string | string[] | CoreMessage[] | Message[]

const app = express()
app.use(express.json())
app.use(cors())

app.post('/', async (req: Request, res: Response) => {
  const { messages, userContext } = req.body

  console.log({ messages: JSON.stringify(messages), userContext })

  const agent = mastra.getAgent('shapeshiftAgent')

  if (typeof messages === 'string') {
    try {
      const message = JSON.parse(messages)
      if ('resume' in message) {
        const workflow = (await agent.getWorkflows())['swapWorkflow']

        const run = await workflow.createRunAsync({ runId: message.resume.runId })

        const resumeParams = {
          step: approveStep,
          resumeData: message.resume.resumePayload,
        }

        const result = await run.resume(resumeParams)

        res.send(result)
      }
    } catch (err) {
      console.log(JSON.stringify(err))
    }
  } else {
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
  }
})

app.use('*', (req, res) => {
  console.log({ req })
  res.status(404).json({ error: 'Route not found' })
})

app.listen(8080, () => {
  console.log(`agentic-server listening on port ${8080}`)
})
