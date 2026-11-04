
import boxen from "boxen";
import chalk from "chalk";
import ora, { type Ora } from "ora";
import logUpdate from "log-update";

const ASCII_BANNER = `
▐██████ ▐██  ▐██ ▐██ ▐██
▐██ ▐██ ▐███▐███ ▐██ ▐██
▐██ ▐██ ▐██▐█▐██ ▐██████
▐██ ▐██ ▐██  ▐██   ▐██
▐██████ ▐██  ▐██   ▐██
`;

const C = {
  cyan: "#38BDF8",
  muted: "#64748B",
  dim: "#94A3B8",
  border: "#334155",
  text: "#E2E8F0",
  green: "#22C55E",
  yellow: "#FACC15",
};

type Command = {
  name: string;
  usage?: string;
  description: string;
};

const COMMANDS: Command[] = [
  { name: "status", description: "Show current status" },
  { name: "ask", usage: "[prompt...]", description: "Ask the agent to do a coding task" },
  { name: "run", usage: "<cmd...>", description: "Run a shell command safely in the active project" },
  { name: "bot", description: "Run Telegram bot" },
  { name: "help", usage: "[command]", description: "Display help for command" },
];

function commandName(command: Command): string {
  return command.usage
    ? `${command.name} ${command.usage}`
    : command.name;
}

export function splash(
  projectLabel: string,
  modeLabel: string,
): void {
  const banner = chalk.hex(C.cyan).bold(ASCII_BANNER.trim());

  const header = [
    chalk.bold.hex(C.cyan)("OMY"),
    chalk.hex(C.muted)(" / "),
    chalk.italic.hex(C.dim)("personal AI coding agent"),
  ].join("");

  const separator = chalk.hex(C.border)("─".repeat(48));

  const metadata = [
    `${chalk.hex(C.muted)("STATUS  ")} ${chalk.greenBright("●")} ${chalk.hex(C.text)("READY")}`,
    `${chalk.hex(C.muted)("MODE    ")} ${chalk.hex(C.cyan)(modeLabel)}`,
    `${chalk.hex(C.muted)("PROJECT ")} ${chalk.hex(C.text)(projectLabel)}`,
  ].join("\n");

  const commands = COMMANDS.map((command) => {
    const name = chalk.hex(C.cyan).bold(commandName(command));
    const description = chalk.hex(C.dim)(command.description);

    return `  ${name.padEnd(25)} ${description}`;
  }).join("\n");

  const options = [
    `${chalk.hex(C.cyan).bold("-V, --version")}  ${chalk.hex(C.dim)("Output version number")}`,
    `${chalk.hex(C.cyan).bold("-h, --help")}     ${chalk.hex(C.dim)("Display help for command")}`,
  ].join("\n");

  const telegramNote =
    `${chalk.hex(C.yellow)("NOTE")} ${chalk.hex(C.dim)("bot requires TELEGRAM_BOT_TOKEN + TELEGRAM_OWNER_ID")}`;

  const content = [
    banner,
    "",
    header,
    separator,
    metadata,
    "",
    chalk.hex(C.cyan).bold("COMMANDS"),
    commands,
    "",
    chalk.hex(C.cyan).bold("OPTIONS"),
    options,
    "",
    telegramNote,
  ].join("\n");

  const card = boxen(content, {
    padding: { top: 1, bottom: 1, left: 2, right: 2 },
    margin: { top: 1, bottom: 1 },
    borderStyle: "round",
    borderColor: C.border,
  });

  process.stdout.write(`${card}\n`);
}

export function createSpinner(text: string): Ora {
  return ora({
    text: chalk.hex(C.dim)(text),
    spinner: {
      interval: 80,
      frames: [
        "⠋", "⠙", "⠹", "⠸", "⠼",
        "⠴", "⠦", "⠧", "⠇", "⠏",
      ].map((frame) => chalk.hex(C.cyan)(frame)),
    },
  }).start();
}

export type StreamRenderer = {
  write: (chunk: string) => void;
  end: () => void;
};

export function createStreamRenderer(
  badge = chalk.bgHex("#0EA5E9").bold.black(" OMY "),
): StreamRenderer {
  let buffer = "";
  let isDone = false;

  const formatOutput = (text: string): string => {
    if (!text) return "";

    const lines = text.replace(/\r\n/g, "\n").split("\n");

    return lines
      .map((line, index) =>
        index === 0
          ? `${badge} ${line}`
          : `${chalk.hex(C.border)("  │ ")}${line}`,
      )
      .join("\n");
  };

  return {
    write(chunk: string) {
      if (isDone || !chunk) return;

      buffer += chunk;
      logUpdate(formatOutput(buffer));
    },

    end() {
      if (isDone) return;

      isDone = true;
      logUpdate.clear();
      logUpdate.done();

      const finalContent = formatOutput(buffer.trimEnd());

      if (finalContent) {
        process.stdout.write(`${finalContent}\n\n`);
      }

      buffer = "";
    },
  };
}
