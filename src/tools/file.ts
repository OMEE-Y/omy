
import fs from "node:fs/promises";
import path from "node:path";
import { resolveWithinRoot } from "./paths.js";

export type WriteFileOptions = {
  overwrite?: boolean;
};

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

async function getProjectRoot(projectRoot: string): Promise<string> {
  return await fs.realpath(projectRoot);
}

async function resolveExistingPath(
  projectRoot: string,
  filePath: string,
): Promise<string> {
  const root = await getProjectRoot(projectRoot);
  const resolved = resolveWithinRoot(root, filePath);
  const realPath = await fs.realpath(resolved);

  if (!isWithinRoot(root, realPath)) {
    throw new Error(`Path escapes project root: ${filePath}`);
  }

  return realPath;
}

// --------------------------------------------------
// Read File
// --------------------------------------------------

export async function readFileText(
  projectRoot: string,
  filePath: string,
): Promise<string> {
  const full = await resolveExistingPath(projectRoot, filePath);

  const stat = await fs.stat(full);

  if (!stat.isFile()) {
    throw new Error(`Not a regular file: ${filePath}`);
  }

  return await fs.readFile(full, "utf8");
}

// --------------------------------------------------
// Write File
// --------------------------------------------------

export async function writeFileText(
  projectRoot: string,
  filePath: string,
  content: string,
  opts: WriteFileOptions = {},
): Promise<void> {
  const root = await getProjectRoot(projectRoot);
  const full = resolveWithinRoot(root, filePath);

  const parent = path.dirname(full);

  await fs.mkdir(parent, { recursive: true });

  // Resolve parent to detect symlink traversal.
  const realParent = await fs.realpath(parent);

  if (!isWithinRoot(root, realParent)) {
    throw new Error(`Parent directory escapes project root: ${filePath}`);
  }

  const target = path.join(realParent, path.basename(full));

  // Never follow an existing target symlink.
  try {
    const stat = await fs.lstat(target);

    if (stat.isSymbolicLink()) {
      throw new Error(`Refusing to write through symlink: ${filePath}`);
    }

    if (!stat.isFile()) {
      throw new Error(`Target is not a regular file: ${filePath}`);
    }

    if (!opts.overwrite) {
      throw new Error(`Refusing to overwrite existing file: ${filePath}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  // wx prevents accidental overwrites, including concurrent creation.
  // w allows intentional overwrites.
  await fs.writeFile(target, content, {
    encoding: "utf8",
    flag: opts.overwrite ? "w" : "wx",
  });
}

// --------------------------------------------------
// Delete File
// --------------------------------------------------

export async function deleteFile(
  projectRoot: string,
  filePath: string,
): Promise<void> {
  const root = await getProjectRoot(projectRoot);
  const full = resolveWithinRoot(root, filePath);

  const parent = await fs.realpath(path.dirname(full));

  if (!isWithinRoot(root, parent)) {
    throw new Error(`Parent directory escapes project root: ${filePath}`);
  }

  const target = path.join(parent, path.basename(full));

  const stat = await fs.lstat(target);

  if (stat.isSymbolicLink()) {
    throw new Error(`Refusing to delete symlink: ${filePath}`);
  }

  if (!stat.isFile()) {
    throw new Error(`Not a regular file: ${filePath}`);
  }

  await fs.unlink(target);
}

// --------------------------------------------------
// List Directory
// --------------------------------------------------

export async function listDir(
  projectRoot: string,
  dirPath = ".",
): Promise<string[]> {
  const full = await resolveExistingPath(projectRoot, dirPath);

  const stat = await fs.stat(full);

  if (!stat.isDirectory()) {
    throw new Error(`Not a directory: ${dirPath}`);
  }

  const entries = await fs.readdir(full, {
    withFileTypes: true,
  });

  return entries
    .map((entry) =>
      entry.isDirectory() ? `${entry.name}/` : entry.name,
    )
    .sort();
}
