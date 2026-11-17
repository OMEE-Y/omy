import { password } from "@inquirer/prompts";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export async function runSetup() {
  const key = await password({
    message: "Groq API key:",
    validate: (v) => v.trim() ? true : "API key required",
  });

  const dir = path.join(os.homedir(), ".omy");
  mkdirSync(dir, { recursive: true });

  writeFileSync(
    path.join(dir, ".env"),
    `GROQ_API_KEY=${JSON.stringify(key.trim())}\n`,
    { mode: 0o600 },
  );

  console.log("OMY configured successfully.");
}