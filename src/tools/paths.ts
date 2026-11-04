
import path from "node:path";

/**
 * Resolves a user-provided path within the project root.
 *
 * Prevents:
 * - Parent directory traversal (../)
 * - Absolute paths outside the project
 * - Windows drive/path escapes
 *
 * Note: Symlink validation must happen separately
 * when accessing the filesystem.
 */
export function resolveWithinRoot(
  root: string,
  userPath: string,
): string {
  if (!root.trim()) {
    throw new Error("Project root cannot be empty");
  }

  if (!userPath.trim()) {
    throw new Error("File path cannot be empty");
  }

  const absoluteRoot = path.resolve(root);
  const resolved = path.resolve(absoluteRoot, userPath);

  const relative = path.relative(absoluteRoot, resolved);

  const escapesRoot =
    path.isAbsolute(relative) ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`);

  if (escapesRoot) {
    throw new Error(`Path escapes project root: ${userPath}`);
  }

  return resolved;
}
