import { writeFile, mkdir, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { VexpDaemon } from "./daemon.js";
import { printSuccess, printWarning } from "../ui/banner.js";
const exec = promisify(execFile);
/**
 * Set up vexp for a repo (called ONCE per repo, not per task).
 * Cleans stale state, writes config files, and indexes.
 * Returns the MCP config path.
 */
export async function setupVexpRepo(repoPath) {
    // Clean any stale vexp state (prevents DB lock errors on repo switch)
    await cleanVexpState(repoPath);
    await writeClaudeMd(repoPath);
    await writeHooks(repoPath);
    const mcpConfigPath = await writeMcpConfig(repoPath);
    await indexRepo(repoPath);
    return mcpConfigPath;
}
/**
 * Start the vexp daemon for a single task.
 * Call this per-instance, stop it after each run.
 */
export async function startVexpDaemon(repoPath) {
    const daemon = new VexpDaemon(repoPath);
    await daemon.start();
    return daemon;
}
/**
 * Tear down vexp files (for clean baseline runs or post-run cleanup).
 */
export async function teardownVexp(repoPath) {
    const toRemove = [
        join(repoPath, ".claude", "CLAUDE.md"),
        join(repoPath, ".claude", "settings.json"),
        join(repoPath, ".claude", "hooks"),
        join(repoPath, ".bench-mcp-config.json"),
    ];
    for (const p of toRemove) {
        if (existsSync(p)) {
            await rm(p, { recursive: true, force: true });
        }
    }
}
// ── Internal helpers ────────────────────────────────────────────────
/** Remove .vexp/ directory to prevent stale DB locks. */
async function cleanVexpState(repoPath) {
    const vexpDir = join(repoPath, ".vexp");
    if (existsSync(vexpDir)) {
        await rm(vexpDir, { recursive: true, force: true });
    }
}
async function writeClaudeMd(repoPath) {
    const claudeDir = join(repoPath, ".claude");
    await mkdir(claudeDir, { recursive: true });
    const content = `## vexp — Context-Aware AI Coding

### MANDATORY: use vexp pipeline
For every task — bug fixes, features, refactors, debugging:
**call \`run_pipeline\` FIRST**. It executes context search + impact analysis +
memory recall in a single call, returning compressed results.

Do NOT use grep, glob, Bash, Read, or cat to search/explore the codebase.
vexp returns pre-indexed, graph-ranked context that is more relevant and
uses fewer tokens than manual searching.

### Primary Tool
- \`run_pipeline\` — **USE THIS FOR EVERYTHING**. Single call that runs
  capsule + impact + memory server-side.

### Workflow
1. \`run_pipeline("your task")\` — ALWAYS FIRST
2. Make targeted changes based on the context returned
3. Only call \`run_pipeline\` again if you need more context during implementation
`;
    await writeFile(join(claudeDir, "CLAUDE.md"), content);
}
async function writeHooks(repoPath) {
    const hooksDir = join(repoPath, ".claude", "hooks");
    await mkdir(hooksDir, { recursive: true });
    const guardScript = `#!/usr/bin/env bash
SOCK="${repoPath}/.vexp/daemon.sock"
HEALTHY="${repoPath}/.vexp/healthy"
if [ -S "$SOCK" ] && [ -f "$HEALTHY" ]; then
  echo "DENY: Use run_pipeline instead of Grep/Glob. vexp daemon is running."
  exit 2
fi
exit 0
`;
    await writeFile(join(hooksDir, "vexp-guard.sh"), guardScript, { mode: 0o755 });
    const settings = {
        hooks: {
            PreToolUse: [
                {
                    matcher: "Grep|Glob",
                    hooks: [{ type: "command", command: join(hooksDir, "vexp-guard.sh") }],
                },
            ],
        },
    };
    await writeFile(join(repoPath, ".claude", "settings.json"), JSON.stringify(settings, null, 2));
}
async function writeMcpConfig(repoPath) {
    const configPath = join(repoPath, ".bench-mcp-config.json");
    const config = {
        mcpServers: {
            vexp: {
                command: "npx",
                args: ["-y", "vexp-mcp"],
                env: {
                    VEXP_WORKSPACE: resolve(repoPath),
                },
            },
        },
    };
    await writeFile(configPath, JSON.stringify(config, null, 2));
    return configPath;
}
async function indexRepo(repoPath) {
    console.log("  Indexing repo with vexp...");
    try {
        await exec("npx", ["-y", "vexp-cli", "index"], {
            cwd: repoPath,
            timeout: 300_000,
            maxBuffer: 50 * 1024 * 1024,
        });
        printSuccess("Repo indexed");
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        printWarning(`Index failed: ${msg.slice(0, 120)}. Continuing without index.`);
    }
}
//# sourceMappingURL=enhancer.js.map