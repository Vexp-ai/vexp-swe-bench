import type { LeaderboardData, LeaderboardEntry, RunResult } from "../types.js";
/** Load the bundled leaderboard data. Warns if stale. */
export declare function loadLeaderboard(): LeaderboardData;
/** Fetch fresh leaderboard from GitHub and save to disk. */
export declare function updateLeaderboard(): Promise<LeaderboardData>;
/**
 * Compute our pass@1 from results and build a combined leaderboard.
 */
export declare function buildComparison(results: RunResult[]): LeaderboardEntry[];
/**
 * Find the baseline cost for Claude Sonnet without vexp.
 * Looks for "Claude 4.5 Sonnet" or similar in the leaderboard.
 */
export declare function findBaselineCost(entries: LeaderboardEntry[]): number | null;
/**
 * Compute per-repo pass rates from results.
 */
export declare function perRepoPassRates(results: RunResult[]): Array<{
    repo: string;
    resolved: number;
    total: number;
    pct: number;
}>;
