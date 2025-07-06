
'use server';
/**
 * @fileOverview A flow for summarizing study materials.
 *
 * - summarizeMaterial - Generates a summary from a given text.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';

const SummarizeMaterialInputSchema = z.object({
  materialText: z.string().describe('The text content of the study material to be summarized.'),
});
export type SummarizeMaterialInput = z.infer<typeof SummarizeMaterialInputSchema>;

const SummarizeMaterialOutputSchema = z.object({
  summary: z.string().describe('A concise, well-structured summary of the provided text, formatted with newlines for readability.'),
});
export type SummarizeMaterialOutput = z.infer<typeof SummarizeMaterialOutputSchema>;

const summaryPrompt = ai.definePrompt({
    name: 'summarizeMaterialPrompt',
    input: { schema: SummarizeMaterialInputSchema },
    output: { schema: SummarizeMaterialOutputSchema },
    prompt: `You are an academic assistant. Your task is to summarize the following text from a study material.
Provide a clear and concise summary that captures the key concepts and main points.
Structure the summary into a few short paragraphs or a bulleted list for easy readability.

Use the following text as your source:
---
{{{materialText}}}
---
`,
});

const summarizeMaterialFlow = ai.defineFlow(
  {
    name: 'summarizeMaterialFlow',
    inputSchema: SummarizeMaterialInputSchema,
    outputSchema: SummarizeMaterialOutputSchema,
  },
  async (input) => {
    const { output } = await summaryPrompt(input);
    if (!output) {
      throw new Error('Failed to generate a summary for the material.');
    }
    return output;
  }
);

export async function summarizeMaterial(input: SummarizeMaterialInput): Promise<SummarizeMaterialOutput> {
  return summarizeMaterialFlow(input);
}
