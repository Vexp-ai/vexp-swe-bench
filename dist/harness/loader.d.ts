import type { SwebenchInstance } from "../types.js";
/**
 * Load SWE-bench instances from a JSONL file.
 * Optionally filter by instance IDs.
 */
export declare function loadInstances(jsonlPath: string, filter?: string[]): SwebenchInstance[];
/**
 * Load the bundled 100-task subset.
 */
export declare function loadBundledSubset(filter?: string[]): SwebenchInstance[];
/**
 * Build the prompt sent to the agent for a SWE-bench instance.
 */
export declare function buildPrompt(instance: SwebenchInstance): string;
