import type { LeaderboardData } from "../types.js";
/**
 * Fetch the SWE-bench Verified leaderboard from swebench.com.
 *
 * Uses the "bash-only" category (mini-SWE-agent v2 runs) which has
 * both score and per-instance cost data for nearly all entries.
 */
export declare function fetchLeaderboard(): Promise<LeaderboardData>;
