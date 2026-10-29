import type { SearchHit } from "../tools/search.js";

export type PlannedStep =
  | { type: "search"; query: string }
  | { type: "read"; file: string }
  | { type: "propose"; goal: string }
  | { type: "test"; cmd: string };

export type PlanResult = {
  steps: PlannedStep[];
  rationale: string;
};

function topFilesFromHits(hits: SearchHit[], maxFiles = 3): string[] {
  const counts = new Map<string, number>();
  for (const h of hits) counts.set(h.file, (counts.get(h.file) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxFiles)
    .map(([f]) => f);
}

export function planForPrompt(prompt: string, hits: SearchHit[]): PlanResult {
  const files = topFilesFromHits(hits, 3);
  const steps: PlannedStep[] = [{ type: "search", query: prompt }];
  for (const f of files) steps.push({ type: "read", file: f });

  steps.push({ type: "propose", goal: prompt });

  // Demo-friendly default; doesn't break if project has no tests.
  steps.push({ type: "test", cmd: "npm test" });

  return {
    steps,
    rationale: files.length
      ? `Search results suggest relevant files: ${files.join(", ")}.`
      : "No obvious hits; will propose changes based on prompt and available context.",
  };
}

