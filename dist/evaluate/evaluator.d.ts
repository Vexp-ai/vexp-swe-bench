import type { RunResult } from "../types.js";
export type EvalMode = "docker" | "lightweight";
export interface EvalOptions {
    mode: EvalMode;
    datasetJsonl?: string;
    logDir?: string;
    timeout?: number;
}
/**
 * Evaluate SWE-bench results by running tests against the model patches.
 * Updates the `resolved` field on each result in-place.
 */
export declare function evaluateSwebench(results: RunResult[], opts: EvalOptions): Promise<void>;
export declare function loadResults(jsonlPath: string): RunResult[];
export declare function saveResults(results: RunResult[], outputPath: string): Promise<void>;
