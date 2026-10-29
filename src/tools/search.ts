import fs from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";
import { glob } from "glob";
import readline from "node:readline";
import { rgPath } from "@vscode/ripgrep";
import { resolveWithinRoot } from "./paths.js";

export type SearchHit = {
  file: string;
  line: number;
  text: string;
};

export type SearchOptions = {
  globs?: string[];
  maxResults?: number;
  caseInsensitive?: boolean;
};

type RgMatchEvent = {
  type: "match";
  data: {
    path?: { text?: string };
    lines?: { text?: string };
    line_number?: number;
  };
};

async function searchTextWithRipgrep(
  projectRoot: string,
  query: string,
  opts: SearchOptions,
): Promise<SearchHit[]> {
  const maxResults = opts.maxResults ?? 80;
  if (!query.trim()) return [];

  // Use ripgrep's JSON output to avoid parsing issues on Windows (drive letters contain ':').
  const args: string[] = ["--json", "--no-messages", "--line-number", "--hidden"];

  // Respect gitignore by default, but keep parity with the old search by excluding common heavy dirs.
  args.push("--glob", "!**/node_modules/**");
  args.push("--glob", "!**/dist/**");
  args.push("--glob", "!**/.git/**");

  // File filters (approximate the old glob behavior).
  const patterns = opts.globs?.length ? opts.globs : ["**/*.{ts,tsx,js,jsx,json,md,txt}"];
  for (const p of patterns) args.push("--glob", p);

  if (opts.caseInsensitive) args.push("-i");

  // Keep behavior close to old implementation: literal substring match.
  args.push("--fixed-strings");
  args.push(query);
  args.push(".");

  const child = execa(rgPath, args, {
    cwd: projectRoot,
    reject: false,
    windowsHide: true,
    stdout: "pipe",
    stderr: "pipe",
  });

  const hits: SearchHit[] = [];
  const rl = readline.createInterface({ input: child.stdout! });

  try {
    for await (const line of rl) {
      let evt: unknown;
      try {
        evt = JSON.parse(line);
      } catch {
        continue;
      }

      const e = evt as Partial<RgMatchEvent>;
      if (e.type !== "match") continue;

      const absPath = e.data?.path?.text;
      const lineNumber = e.data?.line_number;
      const text = e.data?.lines?.text;
      if (!absPath || typeof lineNumber !== "number" || typeof text !== "string") continue;

      // Convert to repo-relative POSIX-ish path for consistent display.
      const rel = path.relative(projectRoot, absPath).split(path.sep).join("/");
      hits.push({ file: rel, line: lineNumber, text: text.replace(/\r?\n$/, "") });

      if (hits.length >= maxResults) {
        child.kill("SIGTERM");
        break;
      }
    }
  } finally {
    rl.close();
  }

  // Ensure process has ended; ignore exit code 1 (no matches).
  await child.catch(() => {});
  return hits.slice(0, maxResults);
}

async function searchTextFallback(
  projectRoot: string,
  query: string,
  opts: SearchOptions = {},
): Promise<SearchHit[]> {
  const maxResults = opts.maxResults ?? 80;
  const patterns = opts.globs?.length ? opts.globs : ["**/*.{ts,tsx,js,jsx,json,md,txt}"];
  const files = await glob(patterns, {
    cwd: projectRoot,
    nodir: true,
    ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
    windowsPathsNoEscape: true,
  });

  const q = opts.caseInsensitive ? query.toLowerCase() : query;
  const hits: SearchHit[] = [];

  for (const rel of files) {
    if (hits.length >= maxResults) break;
    const full = resolveWithinRoot(projectRoot, rel);
    let content: string;
    try {
      content = await fs.readFile(full, "utf8");
    } catch {
      continue;
    }
    const lines = content.replace(/\r\n/g, "\n").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const hay = opts.caseInsensitive ? lines[i].toLowerCase() : lines[i];
      if (hay.includes(q)) {
        hits.push({ file: rel.split(path.sep).join("/"), line: i + 1, text: lines[i] });
        if (hits.length >= maxResults) break;
      }
    }
  }

  return hits;
}

export async function searchText(
  projectRoot: string,
  query: string,
  opts: SearchOptions = {},
): Promise<SearchHit[]> {
  try {
    return await searchTextWithRipgrep(projectRoot, query, opts);
  } catch {
    // If ripgrep isn't available or fails unexpectedly, fall back to the old JS scan.
    return await searchTextFallback(projectRoot, query, opts);
  }
}

