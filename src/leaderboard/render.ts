import chalk from "chalk";
import type { LeaderboardEntry } from "../types.js";
import { findBaselineCost } from "./compare.js";

const VEXP_BLUE = chalk.hex("#4c78a8");
const VEXP_PURPLE = chalk.hex("#7c3aed");
const VEXP_GREEN = chalk.hex("#2d8a4e");

/**
 * Render a cost-focused leaderboard table to the terminal.
 * Sorted by $/task (cheapest first). Shows savings vs Sonnet baseline.
 */
export function renderLeaderboard(entries: LeaderboardEntry[], subsetSize: number): void {
  const maxNameLen = Math.max(...entries.map((e) => displayName(e).length), 10);
  const baselineCost = findBaselineCost(entries);

  // Header
  console.log();
  console.log(VEXP_PURPLE.bold("  SWE-bench Verified — Cost Efficiency Leaderboard"));
  console.log(chalk.dim("  Source: swebench.com (bash-only / mini-SWE-agent)"));
  if (baselineCost != null) {
    console.log(chalk.dim(`  Baseline: Claude Sonnet $${baselineCost.toFixed(2)}/task (without vexp)`));
  }

  const lineWidth = maxNameLen + 44;
  console.log(chalk.dim("\n  " + "─".repeat(lineWidth)));

  // Column headers
  const header = "  " +
    padRight("System", maxNameLen + 2) +
    padRight("Score", 10) +
    padRight("$/task", 10) +
    padRight("Savings", 10);
  console.log(chalk.bold(header));
  console.log(chalk.dim("  " + "─".repeat(lineWidth)));

  // Rows
  let hasSelfReported = false;

  for (const entry of entries) {
    const isOurs = entry.isOurs === true;
    const isSelfReported = entry.selfReported === true;
    if (isSelfReported) hasSelfReported = true;

    const name = displayName(entry);
    const scoreFmt = entry.score.toFixed(1) + "%";

    // Cost column
    let costFmt: string;
    if (entry.instanceCost != null) {
      costFmt = "$" + entry.instanceCost.toFixed(2);
    } else {
      costFmt = "  —";
    }

    // Savings column (only for our entry)
    let savingsFmt = "  —";
    if (isOurs && baselineCost != null && entry.instanceCost != null) {
      const pct = ((baselineCost - entry.instanceCost) / baselineCost) * 100;
      if (pct > 0) {
        savingsFmt = VEXP_GREEN.bold(`-${pct.toFixed(0)}%`);
      } else {
        savingsFmt = chalk.red(`+${Math.abs(pct).toFixed(0)}%`);
      }
    }

    const line = "  " +
      padRight(name, maxNameLen + 2) +
      padRight(scoreFmt, 10) +
      padRight(costFmt, 10) +
      padRight(savingsFmt, 10);

    if (isOurs) {
      console.log(VEXP_BLUE.bold("▸ " + line.slice(2)));
    } else if (isSelfReported) {
      console.log(chalk.dim(line));
    } else {
      console.log(line);
    }
  }

  // Footer
  console.log(chalk.dim("  " + "─".repeat(lineWidth)));
  if (hasSelfReported) {
    console.log(chalk.dim("  † Self-reported by vendor, not independently verified"));
  }
  const hasOurs = entries.some((e) => e.isOurs);
  if (hasOurs) {
    console.log(chalk.dim(`  ▸ Our score is on a ${subsetSize}-task representative subset`));
  }
  if (baselineCost != null) {
    console.log(chalk.dim(`  Savings = cost reduction vs Claude Sonnet baseline ($${baselineCost.toFixed(2)}/task)`));
  }
  console.log();
}

function displayName(entry: LeaderboardEntry): string {
  return entry.selfReported ? entry.system + " †" : entry.system;
}

/** Pad string to width, accounting for ANSI escape codes. */
function padRight(s: string, width: number): string {
  const visible = s.replace(/\x1b\[[0-9;]*m/g, "");
  return s + " ".repeat(Math.max(0, width - visible.length));
}
