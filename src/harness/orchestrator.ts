import { mkdirSync, appendFileSync, readFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { RunConfig, RunResult } from "../types.js";
import { loadInstances, loadBundledSubset, buildPrompt } from "./loader.js";
import { setupRepo, resetRepo, capturePatch, cleanupRepo, cleanupAllRepos } from "./repo.js";
import { getAdapter } from "../agents/registry.js";
import { ensureVexp, ensureVexpLicense } from "../vexp/ensure.js";
import { setupVexpRepo, startVexpDaemon } from "../vexp/enhancer.js";
import { printBanner, printSeparator, printInstanceHeader, printResult, printWarning, printSummary } from "../ui/banner.js";
import { Progress } from "../ui/progress.js";

const DEFAULT_ALLOWED_TOOLS = ["Edit", "Write", "Bash", "Read", "Glob", "Grep", "TodoWrite"];

/**
 * Main SWE-bench benchmark orchestrator.
 *
 * Loads instances, sets up repos, runs the agent on each instance,
 * captures patches, and writes results to JSONL.
 * Returns the path to the output JSONL file.
 */
export async function runBenchmark(config: RunConfig): Promise<string> {
  printBanner();

  // Load instances
  const instances = config.dataJsonl
    ? loadInstances(config.dataJsonl, config.instanceIds)
    : loadBundledSubset(config.instanceIds);

  if (instances.length === 0) {
    throw new Error("No SWE-bench instances matched the filter");
  }

  // Resume mode: load completed instance IDs from previous JSONL
  const completedIds = new Set<string>();
  let outputPath: string;

  if (config.resumeFrom) {
    outputPath = config.resumeFrom;
    if (existsSync(outputPath)) {
      const lines = readFileSync(outputPath, "utf-8").split("\n").filter((l) => l.trim());
      for (const line of lines) {
        try {
          const r = JSON.parse(line) as RunResult;
          completedIds.add(r.instanceId);
        } catch { /* skip invalid lines */ }
      }
      console.log(`  Resuming: ${completedIds.size} instances already completed`);
    }
  } else {
    // Clean previous results and plots (only on fresh runs)
    cleanPreviousRun(config.outputDir);
    cleanPreviousRun("plots");
    outputPath = join(config.outputDir, `swebench-${dateStamp()}.jsonl`);
  }

  const remaining = instances.filter((i) => !completedIds.has(i.instance_id));

  console.log(`  Loaded ${instances.length} instance(s)${remaining.length < instances.length ? `, ${remaining.length} remaining` : ""}`);
  console.log(`  Agent: ${config.agent} | Model: ${config.model}`);
  console.log(`  vexp: ${config.useVexp ? "enabled" : "disabled"}`);
  console.log(`  Limits: ${config.maxTurns} turns, $${config.costLimitUsd}/task`);

  // Ensure vexp is available (auto-install if needed) and has Pro/Team license
  if (config.useVexp) {
    await ensureVexp();
    await ensureVexpLicense();
  }

  // Cleanup stale repos from previous interrupted runs
  await cleanupAllRepos();

  // Get agent adapter
  const adapter = getAdapter(config.agent);

  mkdirSync(config.outputDir, { recursive: true });

  // Group remaining instances by repo for efficient setup (clone once per repo)
  const byRepo = new Map<string, typeof remaining>();
  for (const inst of remaining) {
    const list = byRepo.get(inst.repo) ?? [];
    list.push(inst);
    byRepo.set(inst.repo, list);
  }

  const progress = new Progress(remaining.length);
  let totalPatched = 0;
  let totalCost = 0;
  let instanceIndex = 0;

  for (const [repoSlug, repoInstances] of byRepo) {
    printSeparator(`Repository: ${repoSlug} (${repoInstances.length} tasks)`);

    const firstCommit = repoInstances[0].base_commit;

    let localPath = "<dry-run>";
    if (!config.dryRun) {
      const repo = await setupRepo(repoSlug, firstCommit);
      localPath = repo.localPath;
    }

    // Setup vexp ONCE per repo (clean state, write config, index)
    let mcpConfigPath: string | undefined;
    if (!config.dryRun && config.useVexp) {
      mcpConfigPath = await setupVexpRepo(localPath);
    }

    for (const instance of repoInstances) {
      printInstanceHeader(instance.instance_id, instanceIndex, instances.length);

      if (config.dryRun) {
        const preview = instance.problem_statement.slice(0, 60);
        console.log(`  [dry-run] Would run: ${adapter.name} "${preview}..."`);
        instanceIndex++;
        continue;
      }

      // Reset repo to base commit
      await resetRepo(localPath, instance.base_commit);

      // Start daemon per-task (different commit may affect context)
      let daemon: { stop: () => Promise<void> } | undefined;
      if (config.useVexp) {
        daemon = await startVexpDaemon(localPath);
      }

      try {
        const prompt = buildPrompt(instance);

        const agentResult = await adapter.run({
          prompt,
          cwd: localPath,
          model: config.model,
          maxTurns: config.maxTurns,
          costLimitUsd: config.costLimitUsd,
          thinkingBudget: config.thinkingBudget,
          timeoutMs: config.timeoutSeconds > 0 ? config.timeoutSeconds * 1000 : 0,
          mcpConfigPath,
          allowedTools: DEFAULT_ALLOWED_TOOLS,
        });

        const modelPatch = await capturePatch(localPath);

        // Collect vexp metrics if available
        let vexpMetrics = null;
        if (config.useVexp) {
          try {
            const { collectVexpMetrics } = await import("../vexp/metrics.js");
            vexpMetrics = await collectVexpMetrics(localPath);
          } catch {
            // vexp metrics are optional
          }
        }

        const result: RunResult = {
          instanceId: instance.instance_id,
          repo: instance.repo,
          timestamp: new Date().toISOString(),
          commitHash: instance.base_commit,
          model: config.model,
          agent: adapter.name,

          inputTokens: agentResult.metrics.inputTokens,
          outputTokens: agentResult.metrics.outputTokens,
          cacheReadTokens: agentResult.metrics.cacheReadTokens,
          cacheCreationTokens: agentResult.metrics.cacheCreationTokens,
          costUsd: agentResult.metrics.costUsd,
          numTurns: agentResult.metrics.numTurns,
          durationMs: agentResult.metrics.durationMs,
          toolCalls: agentResult.metrics.toolCalls,

          modelPatch,
          resolved: null, // populated by evaluator
          vexpMetrics,
        };

        appendFileSync(outputPath, JSON.stringify(result) + "\n");

        printResult("tokens", `${result.inputTokens} in / ${result.outputTokens} out`);
        printResult("turns", String(result.numTurns));
        printResult("cost", `$${result.costUsd.toFixed(4)}`);
        printResult("duration", `${(result.durationMs / 1000).toFixed(1)}s`);
        printResult("patch", modelPatch ? `${modelPatch.split("\n").length} lines` : "empty");

        totalCost += result.costUsd;
        if (modelPatch.trim()) totalPatched++;
        progress.tick(instance.instance_id, !!modelPatch.trim());
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        printWarning(`Failed: ${msg}`);
        progress.tick(instance.instance_id, false);
      } finally {
        // Stop daemon after each task
        if (daemon) {
          await daemon.stop();
        }
      }

      instanceIndex++;
    }

    // Cleanup repo after all tasks for this repo are done
    if (!config.dryRun) {
      await cleanupRepo(localPath);
    }
  }

  if (!config.dryRun) {
    const totalInstances = completedIds.size + remaining.length;
    printSummary(totalInstances, totalPatched, totalCost, outputPath);
    console.log(`  Results written to: ${outputPath}\n`);
  }

  return outputPath;
}

function dateStamp(): string {
  return new Date().toISOString().split("T")[0];
}

function cleanPreviousRun(dir: string): void {
  if (!existsSync(dir)) return;
  const files = readdirSync(dir).filter((f) => f !== ".gitkeep");
  for (const f of files) {
    rmSync(join(dir, f), { recursive: true, force: true });
  }
  if (files.length > 0) {
    printWarning(`Cleaned ${files.length} file(s) from ${dir}/`);
  }
}
