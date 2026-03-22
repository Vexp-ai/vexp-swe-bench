import type { RunConfig } from "../types.js";
/**
 * Main SWE-bench benchmark orchestrator.
 *
 * Loads instances, sets up repos, runs the agent on each instance,
 * captures patches, and writes results to JSONL.
 * Returns the path to the output JSONL file.
 */
export declare function runBenchmark(config: RunConfig): Promise<string>;
