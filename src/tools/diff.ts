
import { createTwoFilesPatch } from "diff";

export type DiffPreview = {
  filePath: string;
  diff: string;
  hasChanges: boolean;
};

export function diffText(
  filePath: string,
  oldText: string,
  newText: string,
): DiffPreview {
  if (!filePath.trim()) {
    throw new Error("File path cannot be empty");
  }

  if (oldText === newText) {
    return {
      filePath,
      diff: "",
      hasChanges: false,
    };
  }

  const diff = createTwoFilesPatch(
    filePath,
    filePath,
    oldText,
    newText,
    "before",
    "after",
    {
      context: 3,
    },
  );

  return {
    filePath,
    diff,
    hasChanges: true,
  };
}
