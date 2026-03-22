import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { printSuccess, printWarning } from "../ui/banner.js";
const exec = promisify(execFile);
/**
 * Evaluate SWE-bench results by running tests against the model patches.
 * Updates the `resolved` field on each result in-place.
 */
export async function evaluateSwebench(results, opts) {
    const pending = results.filter((r) => r.resolved === null && r.modelPatch);
    if (pending.length === 0) {
        console.log("  No unevaluated results with patches to evaluate.");
        return;
    }
    console.log(`  Evaluating ${pending.length} result(s) in ${opts.mode} mode...`);
    if (opts.mode === "docker") {
        await evaluateDocker(pending, opts);
    }
    else {
        evaluateLightweight(pending);
    }
}
// ── Docker mode (standard SWE-bench evaluation) ─────────────────────
async function evaluateDocker(results, opts) {
    // Check Docker
    try {
        await exec("docker", ["info"], { timeout: 10_000 });
    }
    catch {
        throw new Error("Docker is not available. Install Docker and ensure it's running, " +
            "or use --mode lightweight.");
    }
    // Check swebench Python package
    const python = findPython();
    try {
        await exec(python, ["-c", "import swebench"], { timeout: 10_000 });
    }
    catch {
        throw new Error("swebench Python package not found. Install: pip install swebench");
    }
    // Clean up stale swebench containers from previous failed runs
    try {
        const { stdout: containerIds } = await exec("docker", ["ps", "-a", "--filter", "name=sweb", "-q"], { timeout: 10_000 });
        const ids = containerIds.trim().split("\n").filter((id) => id);
        if (ids.length > 0) {
            console.log(`  Cleaning ${ids.length} stale swebench container(s)...`);
            await exec("docker", ["rm", "-f", ...ids], { timeout: 30_000 });
        }
    }
    catch {
        // ignore cleanup errors
    }
    const datasetName = opts.datasetJsonl ?? "princeton-nlp/SWE-bench_Verified";
    const runId = `vexp-swebench-${Date.now()}`;
    const reportDir = opts.logDir ?? join(process.cwd(), "results", "eval-logs");
    await mkdir(reportDir, { recursive: true });
    // Write predictions JSONL
    const predictions = results.map((r) => ({
        instance_id: r.instanceId,
        model_name_or_path: runId,
        model_patch: r.modelPatch,
    }));
    const predsPath = join(reportDir, "predictions.jsonl");
    await writeFile(predsPath, predictions.map((p) => JSON.stringify(p)).join("\n") + "\n");
    console.log(`  Wrote ${predictions.length} prediction(s) to ${predsPath}`);
    console.log(`  Run ID: ${runId}`);
    console.log(`  Dataset: ${datasetName}`);
    console.log(`  Running swebench evaluation (this may take a while)...`);
    const timeout = (opts.timeout ?? 1800) * results.length;
    try {
        const { stdout, stderr } = await exec(python, [
            "-m", "swebench.harness.run_evaluation",
            "-p", predsPath,
            "-d", datasetName,
            "-id", runId,
            "--report_dir", reportDir,
            "--timeout", String(opts.timeout ?? 1800),
        ], { timeout: timeout * 1000, maxBuffer: 50 * 1024 * 1024 });
        if (stdout)
            console.log(stdout);
        if (stderr)
            console.error(stderr);
    }
    catch (err) {
        // Clean up containers on failure
        try {
            const { stdout: staleIds } = await exec("docker", ["ps", "-a", "--filter", "name=sweb", "-q"], { timeout: 10_000 });
            const ids = staleIds.trim().split("\n").filter((id) => id);
            if (ids.length > 0) {
                await exec("docker", ["rm", "-f", ...ids], { timeout: 30_000 });
            }
        }
        catch { /* ignore */ }
        // Still try to parse any results that were generated before the error
        printWarning("Evaluation had errors, parsing available results...");
        await parseDockerResults(results, reportDir, runId);
        return;
    }
    // Parse grading results
    await parseDockerResults(results, reportDir, runId);
}
async function parseDockerResults(results, reportDir, runId) {
    // swebench writes report to <report_dir>/<run_id>.json, <report_dir>/<run_id>.<run_id>.json,
    // or <report_dir>/report.json depending on the version
    const possiblePaths = [
        join(reportDir, `${runId}.json`),
        join(reportDir, `${runId}.${runId}.json`),
        join(reportDir, "report.json"),
    ];
    let reportPath;
    for (const p of possiblePaths) {
        if (existsSync(p)) {
            reportPath = p;
            break;
        }
    }
    if (!reportPath) {
        printWarning("Report file not found, parsing individual logs...");
        await parseIndividualLogs(results, reportDir, runId);
        return;
    }
    const report = JSON.parse(await readFile(reportPath, "utf-8"));
    // swebench report structure: { "resolved": [...ids], "applied": [...ids], ... }
    // or legacy: { runId: { instanceId: "RESOLVED" | "FAILED" } }
    const resolvedSet = new Set();
    if (Array.isArray(report.resolved)) {
        for (const id of report.resolved)
            resolvedSet.add(id);
    }
    else {
        // Try legacy format
        const instanceResults = report[runId] ?? report;
        for (const [id, status] of Object.entries(instanceResults)) {
            if (status === "RESOLVED")
                resolvedSet.add(id);
        }
    }
    for (const r of results) {
        r.resolved = resolvedSet.has(r.instanceId);
    }
    const resolved = results.filter((r) => r.resolved === true).length;
    printSuccess(`${resolved}/${results.length} instances resolved`);
}
async function parseIndividualLogs(results, reportDir, runId) {
    // swebench writes individual report.json files under <log_dir>/<run_id>/<run_id>/<instance_id>/report.json
    const logDir = join(process.cwd(), "logs", "run_evaluation");
    for (const r of results) {
        // First try individual report.json files (most reliable)
        const reportPaths = [
            join(logDir, runId, runId, r.instanceId, "report.json"),
            join(reportDir, runId, r.instanceId, "report.json"),
            join(reportDir, r.instanceId, "report.json"),
        ];
        let found = false;
        for (const rp of reportPaths) {
            if (existsSync(rp)) {
                try {
                    const report = JSON.parse(await readFile(rp, "utf-8"));
                    const data = report[r.instanceId];
                    r.resolved = data?.resolved === true;
                    found = true;
                    break;
                }
                catch {
                    // invalid JSON, try next
                }
            }
        }
        if (found)
            continue;
        // Fallback to test_output.txt
        const logPaths = [
            join(logDir, runId, runId, r.instanceId, "test_output.txt"),
            join(reportDir, runId, r.instanceId, "test_output.txt"),
            join(reportDir, r.instanceId, "test_output.txt"),
        ];
        for (const logPath of logPaths) {
            if (existsSync(logPath)) {
                const log = await readFile(logPath, "utf-8");
                r.resolved = log.includes("RESOLVED") || log.includes("Tests passed");
                found = true;
                break;
            }
        }
        if (!found) {
            r.resolved = false;
        }
    }
}
// ── Lightweight mode (no Docker) ────────────────────────────────────
function evaluateLightweight(results) {
    console.log("  Lightweight mode: checking if patches are non-empty.");
    console.log("  Note: this does NOT run tests — use Docker mode for accurate evaluation.\n");
    for (const r of results) {
        if (!r.modelPatch || r.modelPatch.trim().length === 0) {
            r.resolved = false;
            console.log(`  ${r.instanceId}: ✗ empty patch`);
            continue;
        }
        const changedLines = r.modelPatch
            .split("\n")
            .filter((l) => (l.startsWith("+") || l.startsWith("-")) && !l.startsWith("+++") && !l.startsWith("---"))
            .length;
        if (changedLines === 0) {
            r.resolved = false;
            console.log(`  ${r.instanceId}: ✗ no meaningful changes`);
        }
        else {
            r.resolved = null;
            console.log(`  ${r.instanceId}: ? ${changedLines} changed lines (needs Docker eval)`);
        }
    }
}
// ── Utilities ───────────────────────────────────────────────────────
function findPython() {
    const venvPy = join(process.cwd(), ".venv", "bin", "python3");
    if (existsSync(venvPy))
        return venvPy;
    return "python3";
}
export function loadResults(jsonlPath) {
    const raw = readFileSync(jsonlPath, "utf-8");
    return raw
        .split("\n")
        .filter((l) => l.trim())
        .map((l) => JSON.parse(l));
}
export async function saveResults(results, outputPath) {
    const content = results.map((r) => JSON.stringify(r)).join("\n") + "\n";
    await writeFile(outputPath, content);
}
//# sourceMappingURL=evaluator.js.map