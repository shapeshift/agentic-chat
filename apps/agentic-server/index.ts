import dotenv from 'dotenv';

dotenv.config();

import cors from 'cors';
import express, { Request, Response } from 'express';
import { mastra } from './src/mastra';
import { inspect } from 'util';

const app = express();
app.use(express.json());
app.use(cors());

app.post('/', async (req: Request, res: Response) => {
  const { messages, tools } = req.body;

  const agent = mastra.getAgent('shapeshiftAgent');
  const result = await agent.stream(messages, { clientTools: tools });


  result.pipeDataStreamToResponse(res);

  const reqBody = (await (result.request)).body

  debugger

  console.log({req: inspect(reqBody, false, null, true)});
});

app.listen(8080, () => {
  console.log(`agentic-server listening on port ${8080}`);
});
