
import fs from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";
import { glob } from "glob";
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

const DEFAULT_MAX_RESULTS = 80;
const MAX_SEARCH_RESULTS = 1000;

const DEFAULT_GLOBS = [
  "**/*.{ts,tsx,js,jsx,json,md,txt}",
];

const IGNORED_DIRS = [
  "**/node_modules/**",
  "**/dist/**",
  "**/.git/**",
  "**/coverage/**",
  "**/.next/**",
  "**/build/**",
];

// --------------------------------------------------
// Validation
// --------------------------------------------------

function validateOptions(opts: SearchOptions): number {
  const maxResults = opts.maxResults ?? DEFAULT_MAX_RESULTS;

  if (
    !Number.isInteger(maxResults) ||
    maxResults < 1 ||
    maxResults > MAX_SEARCH_RESULTS
  ) {
    throw new Error(
      `maxResults must be between 1 and ${MAX_SEARCH_RESULTS}`,
    );
  }

  if (
    opts.globs?.some(
      (pattern) =>
        typeof pattern !== "string" || !pattern.trim(),
    )
  ) {
    throw new Error("Invalid search glob pattern");
  }

  return maxResults;
}

function getPatterns(opts: SearchOptions): string[] {
  return opts.globs?.length ? opts.globs : DEFAULT_GLOBS;
}

// --------------------------------------------------
// Path Utilities
// --------------------------------------------------

function isWithinRoot(root: string, target: string): boolean {
  const relative = path.relative(root, target);

  return (
    relative === "" ||
    (
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
    )
  );
}

function toRelativePath(root: string, target: string): string {
  const absolute = path.resolve(root, target);

  if (!isWithinRoot(root, absolute)) {
    throw new Error(`Search result escapes project root: ${target}`);
  }

  return path.relative(root, absolute).split(path.sep).join("/");
}

// --------------------------------------------------
// Ripgrep Search
// --------------------------------------------------

async function searchTextWithRipgrep(
  projectRoot: string,
  query: string,
  opts: SearchOptions,
): Promise<SearchHit[]> {
  const maxResults = validateOptions(opts);

  if (!query.trim()) return [];

  const root = await fs.realpath(projectRoot);

  const args: string[] = [
    "--json",
    "--no-messages",
    "--line-number",
    "--hidden",
    "--fixed-strings",
  ];

  // Exclude heavy directories.
  for (const pattern of IGNORED_DIRS) {
    args.push("--glob", `!${pattern}`);
  }

  // Apply file filters.
  for (const pattern of getPatterns(opts)) {
    args.push("--glob", pattern);
  }

  if (opts.caseInsensitive) {
    args.push("--ignore-case");
  }

  // "--" prevents queries beginning with "-" from
  // being interpreted as command-line options.
  args.push("--", query, ".");

  const child = execa(rgPath, args, {
    cwd: root,
    reject: false,
    windowsHide: true,
    stdout: "pipe",
    stderr: "ignore",
  });

  if (!child.stdout) {
    throw new Error("Failed to initialize ripgrep output");
  }

  const hits: SearchHit[] = [];
  let stoppedEarly = false;

  try {
    for await (const line of child.stdout) {
      let event: unknown;

      try {
        event = JSON.parse(line.toString());
      } catch {
        continue;
      }

      const e = event as Partial<RgMatchEvent>;

      if (e.type !== "match" || !e.data) {
        continue;
      }

      const file = e.data.path?.text;
      const lineNumber = e.data.line_number;
      const text = e.data.lines?.text;

      if (
        typeof file !== "string" ||
        typeof lineNumber !== "number" ||
        typeof text !== "string"
      ) {
        continue;
      }

      let relativePath: string;

      try {
        relativePath = toRelativePath(root, file);
      } catch {
        continue;
      }

      hits.push({
        file: relativePath,
        line: lineNumber,
        text: text.replace(/\r?\n$/, ""),
      });

      if (hits.length >= maxResults) {
        stoppedEarly = true;
        child.kill("SIGTERM");
        break;
      }
    }
  } finally {
    // Ensure the child process doesn't remain running.
    if (!stoppedEarly) {
      // Process normally completes when stdout closes.
    }
  }

  const result = await child.catch(() => null);

  if (
    !result ||
    (
      !stoppedEarly &&
      result.exitCode !== 0 &&
      result.exitCode !== 1
    )
  ) {
    throw new Error("Ripgrep search failed");
  }

  return hits.slice(0, maxResults);
}

// --------------------------------------------------
// JavaScript Fallback Search
// --------------------------------------------------

async function searchTextFallback(
  projectRoot: string,
  query: string,
  opts: SearchOptions = {},
): Promise<SearchHit[]> {
  const maxResults = validateOptions(opts);

  if (!query.trim()) return [];

  const root = await fs.realpath(projectRoot);

  const files = await glob(getPatterns(opts), {
    cwd: root,
    nodir: true,
    dot: true,
    follow: false,
    ignore: IGNORED_DIRS,
    windowsPathsNoEscape: true,
  });

  const searchQuery = opts.caseInsensitive
    ? query.toLowerCase()
    : query;

  const hits: SearchHit[] = [];

  for (const rel of files) {
    if (hits.length >= maxResults) break;

    let full: string;

    try {
      full = resolveWithinRoot(root, rel);

      // Reject symlinks and files outside the root.
      const stat = await fs.lstat(full);

      if (!stat.isFile() || stat.isSymbolicLink()) {
        continue;
      }

      const realPath = await fs.realpath(full);

      if (!isWithinRoot(root, realPath)) {
        continue;
      }
    } catch {
      continue;
    }

    let content: string;

    try {
      content = await fs.readFile(full, "utf8");
    } catch {
      continue;
    }

    const lines = content.replace(/\r\n/g, "\n").split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const haystack = opts.caseInsensitive
        ? line.toLowerCase()
        : line;

      if (!haystack.includes(searchQuery)) {
        continue;
      }

      hits.push({
        file: rel.split(path.sep).join("/"),
        line: i + 1,
        text: line,
      });

      if (hits.length >= maxResults) break;
    }
  }

  return hits;
}

// --------------------------------------------------
// Public Search API
// --------------------------------------------------

export async function searchText(
  projectRoot: string,
  query: string,
  opts: SearchOptions = {},
): Promise<SearchHit[]> {
  validateOptions(opts);

  if (!query.trim()) return [];

  try {
    return await searchTextWithRipgrep(
      projectRoot,
      query,
      opts,
    );
  } catch (error) {
    console.warn(
      "[Search] Ripgrep unavailable or failed, using fallback:",
      error,
    );

    return await searchTextFallback(
      projectRoot,
      query,
      opts,
    );
  }
}
