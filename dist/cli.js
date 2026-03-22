#!/usr/bin/env node
import { Command } from "commander";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { printBanner } from "./ui/banner.js";
const program = new Command();
program
    .name("vexp-swe-bench")
    .description("SWE-bench Verified harness — evaluate coding agents on real-world GitHub issues")
    .version("0.1.0");
// ── run ─────────────────────────────────────────────────────────────
program
    .command("run")
    .description("Run the SWE-bench benchmark")
    .option("--model <model>", "Model to use", "claude-opus-4-5-20251101")
    .option("--agent <name>", "Agent adapter", "claude-code")
    .option("--instances <ids>", "Comma-separated instance IDs, or \"*\" for all", "*")
    .option("--data <jsonl>", "Custom JSONL path (default: bundled 100-task subset)")
    .option("--max-turns <n>", "Max agentic turns per instance", "250")
    .option("--cost-limit <usd>", "Max cost per instance in USD (0 = unlimited)", "3")
    .option("--thinking-budget <tokens>", "Thinking token budget for extended thinking (0 = disabled)", "0")
    .option("--timeout <s>", "Per-command timeout in seconds (0 = no global timeout)", "0")
    .option("--no-vexp", "Run without vexp enhancement")
    .option("--output <dir>", "Output directory", "results")
    .option("--resume <jsonl>", "Resume from an interrupted run (skips completed instances)")
    .option("--dry-run", "Preview without executing")
    .action(async (opts) => {
    const { runBenchmark } = await import("./harness/orchestrator.js");
    const instanceIds = opts.instances === "*" ? ["*"] : opts.instances.split(",");
    await runBenchmark({
        model: opts.model,
        agent: opts.agent,
        maxTurns: parseInt(opts.maxTurns),
        costLimitUsd: parseFloat(opts.costLimit),
        thinkingBudget: parseInt(opts.thinkingBudget),
        timeoutSeconds: parseInt(opts.timeout),
        instanceIds,
        dataJsonl: opts.data ?? "",
        outputDir: opts.output,
        useVexp: opts.vexp !== false,
        dryRun: opts.dryRun === true,
        skipEvaluation: false,
        resumeFrom: opts.resume,
    });
});
// ── evaluate ────────────────────────────────────────────────────────
program
    .command("evaluate <jsonl>")
    .description("Evaluate results using Docker or lightweight mode")
    .option("--mode <mode>", "Evaluation mode: docker or lightweight", "docker")
    .option("--dataset <jsonl>", "Full SWE-bench dataset JSONL (for Docker eval)")
    .option("--timeout <s>", "Per-instance eval timeout", "300")
    .action(async (jsonlPath, opts) => {
    const { evaluateSwebench, loadResults, saveResults } = await import("./evaluate/evaluator.js");
    printBanner();
    const results = loadResults(jsonlPath);
    console.log(`  Loaded ${results.length} result(s) from ${jsonlPath}`);
    await evaluateSwebench(results, {
        mode: opts.mode,
        datasetJsonl: opts.dataset,
        timeout: parseInt(opts.timeout),
    });
    // Save updated results
    await saveResults(results, jsonlPath);
    console.log(`  Updated results saved to ${jsonlPath}`);
    // Print summary
    const resolved = results.filter((r) => r.resolved === true).length;
    const total = results.length;
    const pct = total > 0 ? ((resolved / total) * 100).toFixed(1) : "0.0";
    console.log(`\n  Pass@1: ${resolved}/${total} (${pct}%)\n`);
});
// ── stats ────────────────────────────────────────────────────────────
program
    .command("stats <jsonl>")
    .description("Show evaluation statistics without re-evaluating")
    .action(async (jsonlPath) => {
    const { loadResults } = await import("./evaluate/evaluator.js");
    printBanner();
    const results = loadResults(jsonlPath);
    const resolved = results.filter((r) => r.resolved === true).length;
    const failed = results.filter((r) => r.resolved === false).length;
    const pending = results.filter((r) => r.resolved === null).length;
    const total = results.length;
    const evaluated = resolved + failed;
    const pct = evaluated > 0 ? ((resolved / evaluated) * 100).toFixed(1) : "0.0";
    const pctTotal = total > 0 ? ((resolved / total) * 100).toFixed(1) : "0.0";
    console.log(`  Loaded ${total} result(s) from ${jsonlPath}`);
    console.log(`  Resolved: ${resolved}  Failed: ${failed}  Pending: ${pending}`);
    console.log(`\n  Pass@1 (evaluated): ${resolved}/${evaluated} (${pct}%)`);
    console.log(`  Pass@1 (total):     ${resolved}/${total} (${pctTotal}%)\n`);
});
// ── compare ──────────────────────────────────────────────────────────
program
    .command("compare <vexp-jsonl>")
    .description("Compare vexp results against external agents and generate plots")
    .option("--baseline <jsonl>", "Baseline results JSONL (no-vexp run)")
    .option("--output <dir>", "Output directory for plots", "plots")
    .option("--dpi <n>", "Chart resolution", "150")
    .action(async (vexpPath, opts) => {
    const { loadResults } = await import("./evaluate/evaluator.js");
    const { buildCompare, printCompare, listExternalAgents } = await import("./compare/compare.js");
    printBanner();
    const vexpResults = loadResults(vexpPath);
    console.log(`  Loaded ${vexpResults.length} vexp result(s) from ${vexpPath}`);
    let baselineResults = null;
    if (opts.baseline) {
        baselineResults = loadResults(opts.baseline);
        console.log(`  Loaded ${baselineResults.length} baseline result(s) from ${opts.baseline}`);
    }
    // Auto-detect all available external agents
    const externalNames = listExternalAgents();
    if (externalNames.length > 0) {
        console.log(`  External agents: ${externalNames.join(", ")}`);
    }
    const entries = buildCompare(vexpResults, baselineResults, externalNames);
    printCompare(entries, vexpResults, externalNames);
    // Generate comparison plots
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const exec = promisify(execFile);
    const scriptPath = join(import.meta.dirname ?? ".", "..", "scripts", "plot.py");
    if (existsSync(scriptPath)) {
        const python = findPython();
        const plotArgs = [scriptPath, vexpPath, "-o", opts.output, "--dpi", opts.dpi];
        if (opts.baseline)
            plotArgs.push("--baseline", opts.baseline);
        for (const ext of externalNames)
            plotArgs.push("--external", ext);
        console.log(`  Generating charts...`);
        const { stdout, stderr } = await exec(python, plotArgs, { maxBuffer: 10 * 1024 * 1024 });
        if (stdout)
            console.log(stdout);
        if (stderr)
            console.error(stderr);
        console.log(`  Charts saved to ${opts.output}/`);
    }
});
// ── list ─────────────────────────────────────────────────────────────
program
    .command("list")
    .description("List the benchmark instances")
    .option("--data <jsonl>", "Custom JSONL path")
    .action(async (opts) => {
    const { loadInstances, loadBundledSubset } = await import("./harness/loader.js");
    printBanner();
    const instances = opts.data
        ? loadInstances(opts.data)
        : loadBundledSubset();
    console.log(`  ${instances.length} instance(s):\n`);
    // Group by repo
    const byRepo = new Map();
    for (const inst of instances) {
        byRepo.set(inst.repo, (byRepo.get(inst.repo) ?? 0) + 1);
    }
    for (const [repo, count] of [...byRepo.entries()].sort()) {
        console.log(`    ${repo.padEnd(35)} ${String(count).padStart(4)} instances`);
    }
    console.log(`\n  Total: ${instances.length} instances across ${byRepo.size} repos\n`);
});
// ── helpers ──────────────────────────────────────────────────────────
function findPython() {
    const venvPy = join(process.cwd(), ".venv", "bin", "python3");
    if (existsSync(venvPy))
        return venvPy;
    return "python3";
}
program.parse();
//# sourceMappingURL=cli.js.map