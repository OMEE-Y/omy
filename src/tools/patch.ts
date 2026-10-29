import { createTwoFilesPatch } from "diff";

export type DiffPreview = {
  filePath: string;
  diff: string;
};

export function diffText(filePath: string, oldText: string, newText: string): DiffPreview {
  const diff = createTwoFilesPatch(filePath, filePath, oldText, newText, "before", "after", {
    context: 3,
  });
  return { filePath, diff };
}

