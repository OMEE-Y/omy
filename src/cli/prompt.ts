import { input } from "@inquirer/prompts";

export async function askUserPrompt(): Promise<string> {
  return await input({
    message: "What should OMY do?",
    required: true,
  });
}