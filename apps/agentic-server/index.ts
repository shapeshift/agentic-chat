import dotenv from 'dotenv';

dotenv.config();

import cors from 'cors';
import express, { Request, Response } from 'express';
import { mastra } from './src/mastra';

const app = express();
app.use(express.json());
app.use(cors());

app.post('/', async (req: Request, res: Response) => {
  const { messages, tools } = req.body;

  const agent = mastra.getAgent('shapeshiftAgent');
  const result = await agent.stream(messages, { clientTools: tools });

  // Set up response headers for streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Create a custom response handler that logs chunks
  const originalWrite = res.write.bind(res);
  res.write = function(chunk: any, ...args: any[]) {
    try {
      // Convert Uint8Array to string using TextDecoder
      const decoder = new TextDecoder();
      const chunkStr = decoder.decode(chunk);
      
      // Split by newlines in case we get multiple chunks
      const lines = chunkStr.split('\n').filter(Boolean);
      
      for (const line of lines) {
        // Extract the prefix and data
        const match = line.match(/^([a-z0-9]):(.+)$/);
        if (!match) continue;
        
        const [, prefix, data] = match;
        if (!data) continue;

        try {
          // Try to parse the data as JSON
          const parsed = JSON.parse(data);
          console.log(`[${prefix}]`, JSON.stringify(parsed, null, 2));
        } catch (e) {
          // If not JSON, just log the raw data
          console.log(`[${prefix}]`, data);
        }
      }
    } catch (e) {
      console.log('Error processing chunk:', e);
      console.log('Raw chunk:', chunk);
    }
    return originalWrite(chunk, ...args);
  };

  result.pipeDataStreamToResponse(res);

  const request = (await result.request)
  const response = (await result.response)
  debugger
});

app.listen(8080, () => {
  console.log(`agentic-server listening on port ${8080}`);
});
