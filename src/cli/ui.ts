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

export function splash(projectLabel: string, modeLabel: string): void {
  const banner = ASCII_BANNER.trim()
    ? `${chalk.cyanBright(ASCII_BANNER.trim())}\n\n`
    : "";

  const header = `${chalk.bold.hex("#38BDF8")("OMY")} ${chalk.hex("#64748B")("—")} ${chalk.italic.hex("#94A3B8")("autonomous engineering agent")}`;

  const metadata = [
    `${chalk.hex("#64748B")("status  ")} ${chalk.greenBright("●")} ${chalk.hex("#E2E8F0")("ready")}`,
    `${chalk.hex("#64748B")("runtime ")} ${chalk.hex("#38BDF8")(modeLabel)}`,
    `${chalk.hex("#64748B")("target  ")} ${chalk.dim(projectLabel)}`,
  ].join("\n");

  const content = [banner, header, chalk.hex("#334155")("─".repeat(44)), metadata]
    .filter(Boolean)
    .join("\n");

  const card = boxen(content, {
    padding: { top: 1, bottom: 1, left: 2, right: 3 },
    margin: { top: 1, bottom: 1 },
    borderStyle: "round",
    borderColor: "#334155",
  });

  process.stdout.write(card + "\n");
}

export function createSpinner(text: string): Ora {
  return ora({
    text: chalk.hex("#94A3B8")(text),
    spinner: {
      interval: 80,
      frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"].map((f) =>
        chalk.hex("#38BDF8")(f)
      ),
    },
  }).start();
}

export type StreamRenderer = {
  write: (chunk: string) => void;
  end: () => void;
};

export function createStreamRenderer(
  badge = chalk.bgHex("#0EA5E9").bold.black(" OMY ")
): StreamRenderer {
  let buffer = "";
  let isDone = false;

  const formatOutput = (text: string): string => {
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    if (lines.length === 0) return "";

    const first = `${badge} ${lines[0]}`;
    if (lines.length === 1) return first;

    const middle = lines
      .slice(1, -1)
      .map((line) => `${chalk.hex("#334155")("  │ ")}${line}`)
      .join("\n");

    const last = `${chalk.hex("#334155")("  │ ")}${lines[lines.length - 1]}`;

    return middle ? `${first}\n${middle}\n${last}` : `${first}\n${last}`;
  };

  return {
    write(chunk: string) {
      if (isDone) return;
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
    },
  };
}