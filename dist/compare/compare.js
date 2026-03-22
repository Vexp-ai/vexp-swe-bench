import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
const EXTERNAL_DIR = join(import.meta.dirname ?? ".", "..", "..", "data", "external");
/** List available external agents. */
export function listExternalAgents() {
    if (!existsSync(EXTERNAL_DIR))
        return [];
    return readdirSync(EXTERNAL_DIR)
        .filter((f) => f.endsWith("-resolved.json"))
        .map((f) => f.replace("-resolved.json", ""));
}
/** Load an external agent's resolved IDs. */
export function loadExternalAgent(name) {
    const path = join(EXTERNAL_DIR, `${name}-resolved.json`);
    if (!existsSync(path)) {
        throw new Error(`External agent data not found: ${path}\nAvailable: ${listExternalAgents().join(", ")}`);
    }
    return JSON.parse(readFileSync(path, "utf-8"));
}
/** Build comparison table from vexp results, optional baseline, and external agents. */
export function buildCompare(vexpResults, baselineResults, externalNames) {
    const vexpIds = new Set(vexpResults.map((r) => r.instanceId));
    const total = vexpIds.size;
    const entries = [];
    // vexp entry
    const vexpResolved = vexpResults.filter((r) => r.resolved === true).length;
    const vexpCost = vexpResults.reduce((s, r) => s + r.costUsd, 0) / total;
    entries.push({
        system: "vexp + Claude Code (Opus 4.5)",
        resolved: vexpResolved,
        total,
        pct: (vexpResolved / total) * 100,
        avgCost: Math.round(vexpCost * 100) / 100,
        isOurs: true,
    });
    // baseline entry
    if (baselineResults) {
        const blMap = new Map(baselineResults.map((r) => [r.instanceId, r]));
        let blResolved = 0;
        let blCostSum = 0;
        let blCount = 0;
        for (const id of vexpIds) {
            const r = blMap.get(id);
            if (r) {
                blCount++;
                if (r.resolved === true)
                    blResolved++;
                blCostSum += r.costUsd;
            }
        }
        entries.push({
            system: `baseline (no vexp) + ${baselineResults[0]?.model ?? "unknown"}`,
            resolved: blResolved,
            total: blCount,
            pct: blCount > 0 ? (blResolved / blCount) * 100 : 0,
            avgCost: blCount > 0 ? Math.round((blCostSum / blCount) * 100) / 100 : undefined,
            isOurs: false,
        });
    }
    // external agents
    for (const name of externalNames) {
        const agent = loadExternalAgent(name);
        const resolvedOnSubset = agent.resolvedIds.filter((id) => vexpIds.has(id));
        const resolvedCount = resolvedOnSubset.length;
        entries.push({
            system: agent.system,
            resolved: resolvedCount,
            total,
            pct: (resolvedCount / total) * 100,
            avgCost: agent.avgCostPerInstance,
            note: agent.note,
            isOurs: false,
        });
    }
    // Sort by pct descending
    entries.sort((a, b) => b.pct - a.pct);
    return entries;
}
/** Print comparison table to terminal. */
export function printCompare(entries, vexpResults, externalNames) {
    const vexpIds = new Set(vexpResults.map((r) => r.instanceId));
    const vexpResolved = new Set(vexpResults.filter((r) => r.resolved === true).map((r) => r.instanceId));
    console.log("\n  SWE-bench Verified — Agent Comparison");
    console.log("  Evaluated on %d-task subset\n", vexpIds.size);
    const sysWidth = Math.max(30, ...entries.map((e) => e.system.length + 4));
    const header = `  ${"System".padEnd(sysWidth)} ${"Score".padStart(8)} ${"Resolved".padStart(10)} ${"$/task".padStart(8)}`;
    console.log(header);
    console.log("  " + "─".repeat(header.length - 2));
    for (const e of entries) {
        const prefix = e.isOurs ? "▸ " : "  ";
        const sys = (prefix + e.system).padEnd(sysWidth);
        const score = `${e.pct.toFixed(1)}%`.padStart(8);
        const resolved = `${e.resolved}/${e.total}`.padStart(10);
        const cost = e.avgCost != null ? `$${e.avgCost.toFixed(2)}`.padStart(8) : "—".padStart(8);
        console.log(`  ${sys} ${score} ${resolved} ${cost}`);
    }
    console.log("  " + "─".repeat(header.length - 2));
    // Show unique wins
    console.log("\n  Instances resolved ONLY by vexp:");
    for (const name of externalNames) {
        const agent = loadExternalAgent(name);
        const agentSet = new Set(agent.resolvedIds.filter((id) => vexpIds.has(id)));
        const onlyVexp = [...vexpResolved].filter((id) => !agentSet.has(id));
        console.log(`    vs ${agent.system}: ${onlyVexp.length} unique wins`);
    }
    // Notes
    const notes = entries.filter((e) => e.note);
    if (notes.length > 0) {
        console.log("\n  Notes:");
        for (const e of notes) {
            console.log(`    ${e.system}: ${e.note}`);
        }
    }
    console.log();
}
//# sourceMappingURL=compare.js.map