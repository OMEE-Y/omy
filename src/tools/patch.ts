
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

export type PatchOptions = {
  cwd: string;
  filePath: string;
  oldText: string;
  newText: string;
  createIfMissing?: boolean;
};

export type PatchResult = {
  filePath: string;
  success: boolean;
  changes: number;
};

function resolveSafePath(cwd: string, filePath: string): string {
  const root = path.resolve(cwd);
  const target = path.resolve(root, filePath);
  const relative = path.relative(root, target);

  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error("Path traversal is not allowed");
  }

  return target;
}

export async function applyPatch(
  options: PatchOptions,
): Promise<PatchResult> {
  const {
    cwd,
    filePath,
    oldText,
    newText,
    createIfMissing = false,
  } = options;

  if (!cwd.trim() || !filePath.trim()) {
    throw new Error("cwd and filePath are required");
  }

  const absolutePath = resolveSafePath(cwd, filePath);

  let currentText: string;

  try {
    currentText = await readFile(absolutePath, "utf8");
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code === "ENOENT" &&
      createIfMissing &&
      oldText === ""
    ) {
      currentText = "";
    } else {
      throw error;
    }
  }

  // Prevent overwriting changes made after the file was read.
  if (currentText !== oldText) {
    throw new Error(
      `Patch conflict: ${filePath} has changed since it was read`,
    );
  }

  if (oldText === newText) {
    return {
      filePath,
      success: true,
      changes: 0,
    };
  }

  // Create parent directories when necessary.
  await mkdir(path.dirname(absolutePath), { recursive: true });

  await writeFile(absolutePath, newText, "utf8");

  return {
    filePath,
    success: true,
    changes: 1,
  };
}
