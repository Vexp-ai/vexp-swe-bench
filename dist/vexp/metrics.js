import { join } from "node:path";
import { existsSync } from "node:fs";
/**
 * Collect vexp-internal metrics from the .vexp/index.db SQLite database.
 * Returns null if the database is not available.
 */
export async function collectVexpMetrics(repoPath) {
    const dbPath = join(repoPath, ".vexp", "index.db");
    if (!existsSync(dbPath))
        return null;
    try {
        // Dynamic import to avoid hard dependency on better-sqlite3
        const { default: Database } = await import("better-sqlite3");
        const db = new Database(dbPath, { readonly: true });
        try {
            const row = db.prepare(`
        SELECT token_budget, tokens_used, intent, pivot_count, supporting_count
        FROM capsule_feedback
        ORDER BY created_at DESC
        LIMIT 1
      `).get();
            if (!row)
                return null;
            const saved = row.token_budget - row.tokens_used;
            const savingPct = row.token_budget > 0 ? (saved / row.token_budget) * 100 : 0;
            return {
                tokenBudget: {
                    total: row.token_budget,
                    used: row.tokens_used,
                    saved,
                    savingPct,
                },
                graphStats: {
                    nodesAnalyzed: 0,
                    edgesTraversed: 0,
                    queryTimeMs: 0,
                },
                intent: row.intent,
                pivotCount: row.pivot_count,
                supportingCount: row.supporting_count,
            };
        }
        finally {
            db.close();
        }
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=metrics.js.map