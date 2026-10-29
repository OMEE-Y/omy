import { createGroq } from "@ai-sdk/groq";

export function createGroqModel(options: {
  apiKey?: string;
  model: string;
}) {
  const groq = createGroq({
    apiKey: options.apiKey ?? process.env.GROQ_API_KEY,
  });

  return groq(options.model);
}