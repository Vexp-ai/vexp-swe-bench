import type { LeaderboardEntry } from "../types.js";
/**
 * Render a cost-focused leaderboard table to the terminal.
 * Sorted by $/task (cheapest first). Shows savings vs Sonnet baseline.
 */
export declare function renderLeaderboard(entries: LeaderboardEntry[], subsetSize: number): void;
