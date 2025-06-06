import dotenv from 'dotenv';

dotenv.config();

import cors from 'cors';
import express, { Request, Response } from 'express';
import { mastra } from './src/mastra';

const app = express();
app.use(express.json());
app.use(cors());

app.post('/', async (req: Request, res: Response) => {
  console.log({body: req.body})
  const { message, tools } = req.body;

  const agent = mastra.getAgent('shapeshiftAgent');
  const result = await agent.stream(message, { clientTools: tools });

  result.pipeDataStreamToResponse(res);
});

app.listen(8080, () => {
  console.log(`agentic-server listening on port ${8080}`);
});
