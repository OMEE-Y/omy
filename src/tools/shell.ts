import { execa } from "execa";

export type ShellRunOptions = {
  cwd: string;
  timeoutMs?: number;
  allowlist?: string[] | null;
};

const DEFAULT_TIMEOUT_MS = 2 * 60 * 1000;

const DENY_PATTERNS: RegExp[] = [
  /\brm\s+-rf\b/i,
  /\bdel\s+\/s\b/i,
  /\bformat\s+[a-z]:/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bRemove-Item\b/i,
  /\bmkfs\./i,
  /\bdd\s+if=/i,
];

function isAllowedByAllowlist(cmd: string, allowlist: string[] | null | undefined): boolean {
  if (!allowlist || allowlist.length === 0) return true;
  const trimmed = cmd.trim();
  return allowlist.some((a) => trimmed.toLowerCase().startsWith(a.toLowerCase()));
}

export function validateShellCommand(cmd: string, allowlist?: string[] | null) {
  if (!cmd.trim()) throw new Error("Empty command");
  for (const re of DENY_PATTERNS) {
    if (re.test(cmd)) throw new Error(`Blocked dangerous command pattern: ${re}`);
  }
  if (!isAllowedByAllowlist(cmd, allowlist)) {
    throw new Error("Command blocked by allowlist");
  }
}

export async function runShell(cmd: string, opts: ShellRunOptions): Promise<string> {
  validateShellCommand(cmd, opts.allowlist);
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const child = execa(cmd, {
    cwd: opts.cwd,
    shell: true,
    timeout: timeoutMs,
    reject: false,
    windowsHide: true,
  });

  const res = await child;
  const out = [res.stdout, res.stderr].filter(Boolean).join("\n");
  if (res.failed) {
    throw new Error(out || `Command failed with exit code ${res.exitCode ?? "unknown"}`);
  }
  return out.trimEnd();
}

