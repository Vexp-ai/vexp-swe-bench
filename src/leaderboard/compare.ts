import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { LeaderboardData, LeaderboardEntry, RunResult } from "../types.js";
import { printWarning } from "../ui/banner.js";

const LEADERBOARD_PATH = join(import.meta.dirname ?? ".", "..", "..", "data", "leaderboard.json");
const STALE_DAYS = 7;

/** Load the bundled leaderboard data. Warns if stale. */
export function loadLeaderboard(): LeaderboardData {
  const raw = readFileSync(LEADERBOARD_PATH, "utf-8");
  const data = JSON.parse(raw) as LeaderboardData;

  // Check staleness
  if (data.lastUpdated) {
    const age = Date.now() - new Date(data.lastUpdated).getTime();
    const days = Math.floor(age / (1000 * 60 * 60 * 24));
    if (days > STALE_DAYS) {
      printWarning(`Leaderboard data is ${days} days old. Run with --update to refresh.`);
    }
  }

  return data;
}

/** Fetch fresh leaderboard from GitHub and save to disk. */
export async function updateLeaderboard(): Promise<LeaderboardData> {
  const { fetchLeaderboard } = await import("./fetch.js");
  return fetchLeaderboard();
}

/**
 * Compute our pass@1 from results and build a combined leaderboard.
 */
export function buildComparison(results: RunResult[]): LeaderboardEntry[] {
  const leaderboard = loadLeaderboard();

  const total = results.length;
  const resolved = results.filter((r) => r.resolved === true).length;
  const passRate = total > 0 ? (resolved / total) * 100 : 0;

  // Compute our cost metrics
  const totalCostUsd = results.reduce((s, r) => s + r.costUsd, 0);
  const avgCost = total > 0 ? totalCostUsd / total : 0;

  const ourEntry: LeaderboardEntry = {
    system: `vexp + ${results[0]?.model ?? "unknown"}`,
    score: passRate,
    subsetScore: passRate,
    date: new Date().toISOString().slice(0, 7),
    source: "https://vexp.dev",
    isOurs: true,
    totalCost: Math.round(totalCostUsd * 100) / 100,
    instanceCost: Math.round(avgCost * 100) / 100,
  };

  // Combine and sort by instance cost (cheapest first, no-cost entries at end)
  const all: LeaderboardEntry[] = [
    ...leaderboard.entries.map((e) => ({ ...e, isOurs: false })),
    ourEntry,
  ];

  all.sort((a, b) => {
    const ca = a.instanceCost ?? Infinity;
    const cb = b.instanceCost ?? Infinity;
    if (ca !== cb) return ca - cb;
    return b.score - a.score;
  });

  return all;
}

/**
 * Find the baseline cost for Claude Sonnet without vexp.
 * Looks for "Claude 4.5 Sonnet" or similar in the leaderboard.
 */
export function findBaselineCost(entries: LeaderboardEntry[]): number | null {
  const sonnetEntries = entries.filter(
    (e) =>
      !e.isOurs &&
      e.instanceCost != null &&
      /claude.*(sonnet|4\.5\s*sonnet)/i.test(e.system),
  );
  if (sonnetEntries.length === 0) return null;
  // Use the cheapest Sonnet entry as baseline (most favorable comparison)
  sonnetEntries.sort((a, b) => (a.instanceCost ?? Infinity) - (b.instanceCost ?? Infinity));
  return sonnetEntries[0].instanceCost!;
}

/**
 * Compute per-repo pass rates from results.
 */
export function perRepoPassRates(results: RunResult[]): Array<{ repo: string; resolved: number; total: number; pct: number }> {
  const byRepo = new Map<string, { resolved: number; total: number }>();

  for (const r of results) {
    const entry = byRepo.get(r.repo) ?? { resolved: 0, total: 0 };
    entry.total++;
    if (r.resolved === true) entry.resolved++;
    byRepo.set(r.repo, entry);
  }

  return [...byRepo.entries()]
    .map(([repo, { resolved, total }]) => ({
      repo,
      resolved,
      total,
      pct: total > 0 ? (resolved / total) * 100 : 0,
    }))
    .sort((a, b) => b.pct - a.pct);
}
