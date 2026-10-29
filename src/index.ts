#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { loadConfig } from "./config.js";
import { splash, createSpinner, createStreamRenderer } from "./cli/ui.js";
import { askUserPrompt } from "./cli/prompt.js";
import { createAgentRunner } from "./agent/runner.js";

const program = new Command();

program
  .name("omy")
  .description("OMY - personal AI coding agent")
  .version("0.1.0");

program
  .command("status")
  .description("Show current status")
  .action(async () => {
    const cfg = loadConfig();
    splash(cfg.projectRoot, "Local");
  });

program
  .command("ask")
  .description("Ask the agent to do a coding task")
  .argument("[prompt...]", "prompt text")
  .action(async (promptParts: string[]) => {
    const cfg = loadConfig();
    const rawPrompt = promptParts?.length
      ? promptParts.join(" ")
      : await askUserPrompt();
    const prompt = rawPrompt?.trim();

    if (!prompt) {
      process.stdout.write(chalk.yellow("No prompt provided.\n"));
      return;
    }

    splash(cfg.projectRoot, "Local");
    const runner = createAgentRunner(cfg);

    const spinner = createSpinner("Thinking…");
    const stream = createStreamRenderer();
    let hasStreamed = false;

    try {
      await runner.runAsk(prompt, {
        onProgress(step: string) {
          spinner.text = step;
        },
        onStream(chunk: string) {
          if (!hasStreamed) {
            spinner.stop();
            hasStreamed = true;
          }
          stream.write(chunk);
        },
        onDiff(diff: string) {
          process.stdout.write("\n" + chalk.magentaBright("Diff preview") + "\n");
          process.stdout.write(chalk.dim(diff) + "\n\n");
        },
        onResult(_summary: string) {
          spinner.stop();
          stream.end();
          process.stdout.write(chalk.greenBright("✔ Done\n"));
        },
      });
    } catch (err) {
      spinner.stop();
      stream.end();
      process.stderr.write(chalk.redBright("\nError: ") + String(err) + "\n");
      process.exitCode = 1;
    } finally {
      spinner.stop();
    }
  });

program
  .command("run")
  .description("Run a shell command safely in the active project")
  .argument("<cmd...>", "command to run")
  .action(async (cmdParts: string[]) => {
    const cfg = loadConfig();
    splash(cfg.projectRoot, "Local");
    const runner = createAgentRunner(cfg);
    const cmd = cmdParts.join(" ");

    const spinner = createSpinner("Running…");
    try {
      const res = await runner.runShell(cmd, {
        onProgress(step: string) {
          spinner.text = step;
        },
      });
      spinner.stop();
      process.stdout.write(res + "\n");
    } catch (err) {
      spinner.stop();
      process.stderr.write(chalk.redBright("Error: ") + String(err) + "\n");
      process.exitCode = 1;
    }
  });

program
  .command("bot")
  .description("Run Telegram bot (requires TELEGRAM_BOT_TOKEN + TELEGRAM_OWNER_ID)")
  .action(async () => {
    const cfg = loadConfig();
    const { startTelegramBot } = await import("./bot/telegram.js");
    splash(cfg.projectRoot, "Telegram Bot");
    await startTelegramBot(cfg);
  });

async function main() {
  await program.parseAsync(process.argv);
}

main().catch((err) => {
  process.stderr.write(chalk.redBright("Fatal error: ") + String(err) + "\n");
  process.exit(1);
});