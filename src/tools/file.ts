import fs from "node:fs/promises";
import path from "node:path";
import { resolveWithinRoot } from "./paths.js";

export type WriteFileOptions = {
  overwrite?: boolean;
};

export async function readFileText(projectRoot: string, filePath: string): Promise<string> {
  const full = resolveWithinRoot(projectRoot, filePath);
  return await fs.readFile(full, "utf8");
}

export async function writeFileText(
  projectRoot: string,
  filePath: string,
  content: string,
  opts: WriteFileOptions = {},
): Promise<void> {
  const full = resolveWithinRoot(projectRoot, filePath);
  await fs.mkdir(path.dirname(full), { recursive: true });

  if (!opts.overwrite) {
    try {
      await fs.access(full);
      throw new Error(`Refusing to overwrite existing file: ${filePath}`);
    } catch {
      // ok, doesn't exist
    }
  }

  await fs.writeFile(full, content, "utf8");
}

export async function deleteFile(projectRoot: string, filePath: string): Promise<void> {
  const full = resolveWithinRoot(projectRoot, filePath);
  await fs.rm(full, { force: true });
}

export async function listDir(projectRoot: string, dirPath = "."): Promise<string[]> {
  const full = resolveWithinRoot(projectRoot, dirPath);
  const entries = await fs.readdir(full, { withFileTypes: true });
  return entries.map((e) => (e.isDirectory() ? e.name + "/" : e.name)).sort();
}

