import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { printSuccess } from "../ui/banner.js";
const SWEBENCH_URL = "https://www.swebench.com";
const TOTAL_INSTANCES = 500;
const LEADERBOARD_PATH = join(import.meta.dirname ?? ".", "..", "..", "data", "leaderboard.json");
/**
 * Fetch the SWE-bench Verified leaderboard from swebench.com.
 *
 * Uses the "bash-only" category (mini-SWE-agent v2 runs) which has
 * both score and per-instance cost data for nearly all entries.
 */
export async function fetchLeaderboard() {
    console.log("  Fetching leaderboard from swebench.com (bash-only / mini-SWE-agent)...");
    const res = await fetch(SWEBENCH_URL, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok)
        throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const match = html.match(/<script[^>]*id="leaderboard-data"[^>]*>([\s\S]*?)<\/script>/);
    if (!match)
        throw new Error("leaderboard-data script tag not found");
    const categories = JSON.parse(match[1]);
    const bashOnly = categories.find((c) => c.name === "bash-only");
    if (!bashOnly)
        throw new Error("bash-only category not found");
    console.log(`  Found ${bashOnly.results.length} bash-only entries`);
    const entries = bashOnly.results
        .filter((r) => r.name && r.resolved != null)
        .map((r) => ({
        system: r.name,
        score: Math.round(r.resolved * 10) / 10,
        date: r.date ? r.date.slice(0, 7) : "unknown",
        source: r.folder
            ? `https://github.com/swe-bench/experiments/tree/main/evaluation/verified/${r.folder}`
            : r.site ?? "https://www.swebench.com",
        totalCost: r.cost ?? null,
        instanceCost: r.instance_cost != null ? Math.round(r.instance_cost * 100) / 100 : null,
        instanceCalls: r.instance_calls ?? null,
    }));
    // Add Sonnet 4.6 self-reported entry
    entries.push({
        system: "Claude Sonnet 4.6 (self-reported)",
        score: 79.6,
        date: "2025-05",
        source: "https://www.anthropic.com/news/claude-sonnet-4-6",
        selfReported: true,
        totalCost: null,
        instanceCost: null,
    });
    // Sort by instance cost (entries without cost go to the end)
    entries.sort((a, b) => {
        const ca = a.instanceCost ?? Infinity;
        const cb = b.instanceCost ?? Infinity;
        if (ca !== cb)
            return ca - cb;
        return b.score - a.score;
    });
    const withCost = entries.filter((e) => e.instanceCost != null).length;
    const data = {
        lastUpdated: new Date().toISOString().slice(0, 10),
        fullSetSize: TOTAL_INSTANCES,
        subsetSize: 100,
        entries,
    };
    writeFileSync(LEADERBOARD_PATH, JSON.stringify(data, null, 2) + "\n");
    printSuccess(`Leaderboard updated: ${entries.length} systems (${withCost} with cost data)`);
    return data;
}
//# sourceMappingURL=fetch.js.map