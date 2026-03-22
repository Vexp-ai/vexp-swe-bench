import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SwebenchInstance } from "../types.js";

// Resolve data dir relative to package root (works from both src/ and dist/)
const DATA_DIR = join(import.meta.dirname ?? ".", "..", "..", "data");

/**
 * Load SWE-bench instances from a JSONL file.
 * Optionally filter by instance IDs.
 */
export function loadInstances(
  jsonlPath: string,
  filter?: string[],
): SwebenchInstance[] {
  const raw = readFileSync(jsonlPath, "utf-8");
  const instances: SwebenchInstance[] = [];

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    instances.push(JSON.parse(trimmed) as SwebenchInstance);
  }

  if (!filter || filter.length === 0 || (filter.length === 1 && filter[0] === "*")) {
    return instances;
  }

  return instances.filter((inst) => filter.includes(inst.instance_id));
}

/**
 * Load the bundled 100-task subset.
 */
export function loadBundledSubset(filter?: string[]): SwebenchInstance[] {
  const jsonlPath = join(DATA_DIR, "swe-bench-100.jsonl");
  return loadInstances(jsonlPath, filter);
}

/**
 * Build the prompt sent to the agent for a SWE-bench instance.
 */
export function buildPrompt(instance: SwebenchInstance): string {
  return [
    `You are working on the ${instance.repo} repository (Python).`,
    `Fix the following issue by making the necessary code changes.`,
    `Do NOT write or modify tests — only fix the source code.\n`,
    instance.problem_statement,
  ].join("\n");
}
