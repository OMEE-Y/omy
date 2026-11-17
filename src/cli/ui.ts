
import boxen from "boxen";
import chalk from "chalk";
import ora, { type Ora } from "ora";
import logUpdate from "log-update";



const C = {
  cyan: "#38BDF8",
  muted: "#64748B",
  dim: "#94A3B8",
  border: "#334155",
  text: "#E2E8F0",
  yellow: "#FACC15",
};

const COMMANDS = [
  ["setup", "", "Configure Groq API key"],
  ["status", "", "Show agent status"],
  ["ask", "[prompt]", "Ask AI"],
  ["run", "<command>", "Execute shell command"],
  ["bot", "", "Start Telegram bot"],
];

export function splash(project: string, mode: string): void {
  
  const title = chalk.bold("OMY") + chalk.hex(C.muted)(" · personal coding agent");

  const commands = COMMANDS.map(([name, usage, desc]) =>
    `  ${chalk.hex(C.cyan).bold(name.padEnd(8))} ${chalk.hex(C.dim)(usage.padEnd(11))} ${chalk.white(desc)}`
  ).join("\n");

  const content = [
    title,
    chalk.hex(C.border)("─".repeat(38)),
    `${chalk.hex(C.muted)("MODE")}    ${chalk.hex(C.cyan)(mode)}`,
    `${chalk.hex(C.muted)("PROJECT")} ${chalk.white(project)}`,
    "",
    chalk.hex(C.cyan).bold("COMMANDS"),
    commands,
    "",
    chalk.hex(C.dim)("Use omy --help for more options."),
    chalk.hex(C.yellow)("Telegram requires bot credentials."),
  ].join("\n");

  console.log(
    boxen(content, {
      padding: 1,
      borderStyle: "round",
      borderColor: C.border,
    }),
  );
}

export function createSpinner(text: string): Ora {
  return ora({
    text: chalk.hex(C.dim)(text),
    spinner: "dots",
  }).start();
}

export type StreamRenderer = {
  write: (chunk: string) => void;
  end: () => void;
};

export function createStreamRenderer(): StreamRenderer {
  let buffer = "";
  let done = false;

  const format = (text: string) =>
    text.split("\n")
      .map((line, i) =>
        `${i === 0 ? chalk.bgHex("#0EA5E9").black(" OMY ") : chalk.hex(C.border)("  │ ")} ${line}`,
      )
      .join("\n");

  return {
    write(chunk) {
      if (done || !chunk) return;
      buffer += chunk;
      logUpdate(format(buffer));
    },

    end() {
      if (done) return;
      done = true;
      logUpdate.clear();
      logUpdate.done();

      if (buffer.trim()) {
        process.stdout.write(format(buffer.trimEnd()) + "\n\n");
      }

      buffer = "";
    },
  };
}
