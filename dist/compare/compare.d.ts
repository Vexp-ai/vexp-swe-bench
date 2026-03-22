import type { RunResult } from "../types.js";
export interface ExternalAgent {
    system: string;
    score: number;
    date: string;
    source: string;
    note?: string;
    avgCostPerInstance?: number;
    resolvedIds: string[];
}
export interface CompareEntry {
    system: string;
    resolved: number;
    total: number;
    pct: number;
    avgCost?: number;
    note?: string;
    isOurs: boolean;
}
/** List available external agents. */
export declare function listExternalAgents(): string[];
/** Load an external agent's resolved IDs. */
export declare function loadExternalAgent(name: string): ExternalAgent;
/** Build comparison table from vexp results, optional baseline, and external agents. */
export declare function buildCompare(vexpResults: RunResult[], baselineResults: RunResult[] | null, externalNames: string[]): CompareEntry[];
/** Print comparison table to terminal. */
export declare function printCompare(entries: CompareEntry[], vexpResults: RunResult[], externalNames: string[]): void;
