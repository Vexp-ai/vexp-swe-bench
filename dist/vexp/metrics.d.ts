import type { VexpMetrics } from "../types.js";
/**
 * Collect vexp-internal metrics from the .vexp/index.db SQLite database.
 * Returns null if the database is not available.
 */
export declare function collectVexpMetrics(repoPath: string): Promise<VexpMetrics | null>;
