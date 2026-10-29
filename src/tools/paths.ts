import path from "node:path";

export function resolveWithinRoot(root: string, userPath: string): string {
  const resolved = path.resolve(root, userPath);
  const rel = path.relative(root, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel) && rel.includes(":")) {
    throw new Error(`Path escapes project root: ${userPath}`);
  }
  return resolved;
}

