
import fs from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";

export type ShellRunOptions = {
  cwd: string;
  timeoutMs?: number;
  allowlist?: string[] | null;
};

const DEFAULT_TIMEOUT_MS = 2 * 60 * 1000;
const MAX_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

const SHELL_METACHARACTERS = new Set([
  ";", "&", "|", "<", ">", "`", "$", "(", ")",
]);

const BLOCKED_EXECUTABLES = new Set([
  "rm",
  "rmdir",
  "del",
  "format",
  "shutdown",
  "reboot",
  "mkfs",
  "dd",
  "diskpart",
  "sudo",
  "su",
  "chmod",
  "chown",
  "powershell",
  "pwsh",
  "cmd",
  "bash",
  "sh",
  "zsh",
  "fish",
]);

// --------------------------------------------------
// Command Parsing
// --------------------------------------------------

type ParsedCommand = {
  executable: string;
  args: string[];
};

function parseCommand(cmd: string): ParsedCommand {
  if (!cmd.trim()) {
    throw new Error("Empty command");
  }

  const tokens: string[] = [];

  let current = "";
  let quote: "'" | '"' | null = null;
  let escaping = false;
  let started = false;

  for (let i = 0; i < cmd.length; i++) {
    const char = cmd[i];

    if (char === "\0") {
      throw new Error("Null characters are not allowed");
    }

    if (escaping) {
      current += char;
      escaping = false;
      started = true;
      continue;
    }

    if (quote === '"') {
      if (char === '"') {
        quote = null;
      } else if (
        char === "\\" &&
        (cmd[i + 1] === '"' || cmd[i + 1] === "\\")
      ) {
        escaping = true;
      } else {
        current += char;
      }

      started = true;
      continue;
    }

    if (quote === "'") {
      if (char === "'") {
        quote = null;
      } else {
        current += char;
      }

      started = true;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      started = true;
      continue;
    }

    if (char === "\\") {
      // Reject escaped shell operators instead of
      // interpreting potentially ambiguous syntax.
      const next = cmd[i + 1];

      if (next && SHELL_METACHARACTERS.has(next)) {
        throw new Error("Shell escaping is not supported");
      }

      current += char;
      started = true;
      continue;
    }

    if (SHELL_METACHARACTERS.has(char)) {
      throw new Error(
        `Shell operators are not supported: ${char}`,
      );
    }

    if (/\s/.test(char)) {
      if (started) {
        tokens.push(current);
        current = "";
        started = false;
      }

      continue;
    }

    current += char;
    started = true;
  }

  if (escaping || quote !== null) {
    throw new Error("Unclosed quote or escape in command");
  }

  if (started) {
    tokens.push(current);
  }

  if (tokens.length === 0 || !tokens[0]) {
    throw new Error("Invalid command");
  }

  return {
    executable: tokens[0],
    args: tokens.slice(1),
  };
}

// --------------------------------------------------
// Allowlist
// --------------------------------------------------

function normalizeExecutable(executable: string): string {
  return path
    .basename(executable)
    .toLowerCase()
    .replace(/\.(cmd|exe|bat)$/i, "");
}

function isAllowedByAllowlist(
  executable: string,
  allowlist: string[] | null | undefined,
): boolean {
  // Fail closed: no allowlist means no execution.
  if (!allowlist || allowlist.length === 0) {
    return false;
  }

  const normalized = normalizeExecutable(executable);

  return allowlist.some(
    (allowed) =>
      normalizeExecutable(allowed) === normalized,
  );
}

// --------------------------------------------------
// Command Validation
// --------------------------------------------------

export function validateShellCommand(
  cmd: string,
  allowlist?: string[] | null,
): void {
  const parsed = parseCommand(cmd);

  const executable = normalizeExecutable(parsed.executable);

  if (BLOCKED_EXECUTABLES.has(executable)) {
    throw new Error(`Blocked executable: ${executable}`);
  }

  if (
    !isAllowedByAllowlist(
      parsed.executable,
      allowlist,
    )
  ) {
    throw new Error(
      `Command blocked by allowlist: ${executable}`,
    );
  }
}

// --------------------------------------------------
// Working Directory Validation
// --------------------------------------------------

async function validateCwd(cwd: string): Promise<string> {
  if (!cwd.trim()) {
    throw new Error("Working directory cannot be empty");
  }

  const realCwd = await fs.realpath(cwd);
  const stat = await fs.stat(realCwd);

  if (!stat.isDirectory()) {
    throw new Error("Working directory is not a directory");
  }

  return realCwd;
}

// --------------------------------------------------
// Shell Execution
// --------------------------------------------------

export async function runShell(
  cmd: string,
  opts: ShellRunOptions,
): Promise<string> {
  validateShellCommand(cmd, opts.allowlist);

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1000 ||
    timeoutMs > MAX_TIMEOUT_MS
  ) {
    throw new Error(
      `timeoutMs must be between 1000 and ${MAX_TIMEOUT_MS}`,
    );
  }

  const cwd = await validateCwd(opts.cwd);
  const { executable, args } = parseCommand(cmd);

  const result = await execa(executable, args, {
    cwd,

    // Never invoke a shell.
    shell: false,

    timeout: timeoutMs,
    forceKillAfterDelay: 3000,
    killSignal: "SIGTERM",

    reject: false,
    windowsHide: true,

    maxBuffer: MAX_OUTPUT_BYTES,
  });

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";

  const output = [stdout, stderr]
    .filter(Boolean)
    .join("\n");

  if (result.timedOut) {
    throw new Error(
      `Command timed out after ${timeoutMs}ms.\n${output}`,
    );
  }

  if (result.failed) {
    throw new Error(
      output ||
        `Command failed with exit code ${
          result.exitCode ?? "unknown"
        }`,
    );
  }

  return output.trimEnd();
}
