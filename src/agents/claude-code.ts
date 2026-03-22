import { spawn } from "node:child_process";
import { join } from "node:path";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import type { AgentAdapter, AgentRunOptions, AgentRunResult } from "./adapter.js";
import { parseStreamJson } from "../metrics/stream-parser.js";
import { calculateCost } from "../metrics/pricing.js";

/**
 * Claude Code agent adapter.
 *
 * Spawns the `claude` CLI in headless mode with `--output-format stream-json`,
 * parses the structured output for token/cost metrics.
 * Implements cost limit by monitoring the stream in real-time.
 */
export class ClaudeCodeAdapter implements AgentAdapter {
  name = "claude-code";

  async run(opts: AgentRunOptions): Promise<AgentRunResult> {
    const startMs = Date.now();

    const args = [
      "-p", opts.prompt,
      "--output-format", "stream-json",
      "--model", opts.model,
      "--max-turns", String(opts.maxTurns),
      "--verbose",
    ];

    // Extended thinking via effort level
    if (opts.thinkingBudget > 0) {
      args.push("--effort", "high");
    }

    // Tool whitelist for SWE-bench (agent needs to write code)
    if (opts.allowedTools && opts.allowedTools.length > 0) {
      args.push("--allowedTools", opts.allowedTools.join(","));
    }

    // MCP config
    let tmpDir: string | undefined;
    if (opts.mcpConfigPath) {
      args.push("--mcp-config", opts.mcpConfigPath, "--strict-mcp-config");
    } else {
      // No MCP — pass empty config to ensure isolation
      tmpDir = await mkdtemp(join(tmpdir(), "vexp-swebench-"));
      const emptyConfig = join(tmpDir, "mcp.json");
      await writeFile(emptyConfig, JSON.stringify({ mcpServers: {} }));
      args.push("--mcp-config", emptyConfig, "--strict-mcp-config");
    }

    const rawOutput = await spawnAgent(
      "claude", args, opts.cwd,
      opts.timeoutMs, opts.costLimitUsd, opts.model, opts.env,
    );
    const durationMs = Date.now() - startMs;

    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });

    const parsed = parseStreamJson(rawOutput, opts.model);

    // Convert toolCallSummary to simple counts
    const toolCalls: Record<string, number> = {};
    for (const [tool, { count }] of Object.entries(parsed.toolCallSummary)) {
      toolCalls[tool] = count;
    }

    return {
      metrics: {
        inputTokens: parsed.inputTokens,
        outputTokens: parsed.outputTokens,
        cacheReadTokens: parsed.cacheReadTokens,
        cacheCreationTokens: parsed.cacheCreationTokens,
        costUsd: parsed.costUsd,
        numTurns: parsed.numTurns,
        durationMs,
        toolCalls,
      },
      rawOutput,
    };
  }
}

/**
 * Spawn an agent CLI and collect stdout.
 * Monitors stream-json output for cost and kills the process if it exceeds the budget.
 */
function spawnAgent(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  costLimitUsd: number,
  model: string,
  extraEnv?: Record<string, string>,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...extraEnv, CLAUDECODE: undefined },
    });

    let killed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Global timeout (if set)
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        killed = true;
        console.warn(`  ⏱ Timeout after ${(timeoutMs / 1000).toFixed(0)}s — killing agent`);
        proc.kill("SIGTERM");
        setTimeout(() => { if (!proc.killed) proc.kill("SIGKILL"); }, 5000);
      }, timeoutMs);
    }

    // Cost tracking
    let totalInput = 0;
    let totalOutput = 0;
    let cacheRead = 0;
    let cacheCreation = 0;
    let lineBuffer = "";

    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];

    proc.stdout.on("data", (chunk: Buffer) => {
      chunks.push(chunk);

      // Real-time cost monitoring: parse each JSON line as it arrives
      if (costLimitUsd > 0) {
        lineBuffer += chunk.toString("utf-8");
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() ?? ""; // keep incomplete last line

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === "assistant" && event.message?.usage) {
              const u = event.message.usage;
              totalInput += u.input_tokens ?? 0;
              totalOutput += u.output_tokens ?? 0;
              cacheRead += u.cache_read_input_tokens ?? 0;
              cacheCreation += u.cache_creation_input_tokens ?? 0;

              const cost = calculateCost(totalInput, totalOutput, cacheRead, cacheCreation, model);
              if (cost >= costLimitUsd) {
                killed = true;
                console.warn(`  💰 Cost limit ($${costLimitUsd}) reached ($${cost.toFixed(2)}) — stopping agent`);
                proc.kill("SIGTERM");
                setTimeout(() => { if (!proc.killed) proc.kill("SIGKILL"); }, 5000);
              }
            }
          } catch {
            // not valid JSON, skip
          }
        }
      }
    });

    proc.stderr.on("data", (chunk: Buffer) => errChunks.push(chunk));

    proc.on("close", (code) => {
      if (timer) clearTimeout(timer);
      const stdout = Buffer.concat(chunks).toString("utf-8");
      if (killed) {
        resolve(stdout);
        return;
      }
      if (code !== 0) {
        const stderr = Buffer.concat(errChunks).toString("utf-8");
        reject(new Error(`Agent exited with code ${code}:\n${stderr}\n${stdout}`));
        return;
      }
      resolve(stdout);
    });

    proc.on("error", reject);
  });
}
