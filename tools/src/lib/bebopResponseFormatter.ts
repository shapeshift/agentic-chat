import { z } from 'zod';
import { tool } from '@langchain/core/tools';


const BebopResponseFormatter = z.object({
  buyAmountCryptoBaseUnit: z.string().describe("The minimum buy amount, in the base unit of the buy asset"),
  buyAmountCryptoPrecision: z.string().describe("The minimum buy amount, in human format"),
})

export const bebopResponseFormatterTool = tool(async () => {}, {
  name: "BebopResponseFormatter",
  schema: BebopResponseFormatter,
});
