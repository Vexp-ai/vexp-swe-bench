# vexp-swe-bench

**The open benchmark for AI coding agents** — compare resolution rates, cost, and speed on real-world GitHub issues from [SWE-bench Verified](https://www.swebench.com).

Benchmark any coding agent (Claude Code, Codex, Cursor, Augment, Windsurf, OpenHands, and more) on a curated 100-task subset of SWE-bench Verified. Captures pass@1 resolution rates, cost per task, duration, and token usage.

Default configuration: **Claude Code + [vexp](https://vexp.dev)** — context-aware code intelligence that delivers the highest resolution rate at the lowest cost per task.

## Results

Evaluated on a 100-task subset of SWE-bench Verified. All agents use Claude Opus 4.5 for a fair, apples-to-apples comparison.

| Agent | Pass@1 | $/task | Unique Wins |
|-------|--------|--------|-------------|
| **vexp + Claude Code** | **73.0%** | **$0.67** | 7–10 |
| Live-SWE-Agent | 72.0% | $0.86 | — |
| OpenHands | 70.0% | $1.77 | — |
| Sonar Foundation | 70.0% | $1.98 | — |

> vexp resolves more issues at the lowest cost per task — 22% cheaper than the next best agent.

Generate comparison charts: `node dist/cli.js compare results/swebench-2026-03-22.jsonl`

External resolution data sourced from [swe-bench/experiments](https://github.com/swe-bench/experiments). Cost data sourced from each agent's published benchmarks (see [data sources](#external-agent-data-sources) below).

## Quick Start

```bash
git clone https://github.com/nicobailon/vexp-swe-bench.git
cd vexp-swe-bench

# One command setup (Python >= 3.10, Node >= 18, Git required)
./setup.sh

# Run the benchmark
source .venv/bin/activate
node dist/cli.js run
```

The setup script handles Node dependencies, Python venv, pip packages, SWE-bench Verified dataset download, 100-task subset generation, and TypeScript build.

> **Note:** vexp Pro or Team plan is required to run with vexp enabled. The CLI will prompt you to activate a license at first run. Use code **BENCHMARK** at [vexp.dev/#pricing](https://vexp.dev/#pricing) for 14 days of Pro — free.

## Prerequisites

- **Node.js** >= 18
- **Python** >= 3.10 (required by `swebench` evaluation)
- **Git**
- **Docker** (for accurate test evaluation)
- A coding agent CLI (default: [Claude Code](https://docs.anthropic.com/en/docs/claude-code))
- **vexp Pro or Team** plan (auto-detected; [free 14-day trial](https://vexp.dev/#pricing) with code `BENCHMARK`)

To run without vexp:

```bash
node dist/cli.js run --no-vexp
```

## Commands

### `run` — Execute the benchmark

```bash
node dist/cli.js run [options]

Options:
  --model <model>       Model to use (default: "claude-opus-4-5-20251101")
  --agent <name>        Agent adapter (default: "claude-code")
  --instances <ids>     Comma-separated instance IDs, or "*" for all
  --data <jsonl>        Custom JSONL path (default: bundled 100-task subset)
  --max-turns <n>       Max agentic turns per instance (default: 250)
  --cost-limit <usd>    Max cost per instance in USD, 0 = unlimited (default: 3)
  --timeout <s>         Per-command timeout in seconds, 0 = none (default: 0)
  --no-vexp             Run without vexp enhancement
  --output <dir>        Output directory (default: results/)
  --resume <jsonl>      Resume from an interrupted run (skips completed instances)
  --dry-run             Preview without executing
```

The defaults are aligned with [mini-SWE-agent v2](https://github.com/SWE-agent/mini-SWE-agent): 250 turns, $3/task cost limit, no global timeout.

### `evaluate` — Evaluate patches

```bash
node dist/cli.js evaluate results/swebench-2026-03-22.jsonl \
  --dataset swebench-verified-full.jsonl

Options:
  --mode <mode>       docker or lightweight (default: docker)
  --dataset <jsonl>   Full SWE-bench Verified JSONL (required for Docker eval)
  --timeout <s>       Per-instance eval timeout (default: 300)
```

Docker mode runs the actual Python test suite for each instance. Lightweight mode only checks if the patch is non-empty.

### `compare` — Compare with other agents and generate plots

```bash
node dist/cli.js compare results/swebench-2026-03-22.jsonl

Options:
  --baseline <jsonl>  Baseline results JSONL (no-vexp run)
  --output <dir>      Output directory (default: plots/)
  --dpi <n>           Chart resolution (default: 150)
```

Automatically loads all external agent data from `data/external/` and generates comparison charts. Only agents using Claude Opus 4.5 are included for a fair comparison.

#### External agent data sources

| Agent | Date | Resolution data | Cost data |
|-------|------|-----------------|-----------|
| OpenHands | Nov 2025 | [swe-bench/experiments](https://github.com/swe-bench/experiments/tree/main/evaluation/verified/20251127_openhands_claude-opus-4-5) | [OpenHands Index](https://index.openhands.dev) |
| Live-SWE-Agent | Dec 2025 | [swe-bench/experiments](https://github.com/swe-bench/experiments/tree/main/evaluation/verified/20251215_livesweagent_claude-opus-4-5) | [Live-SWE-Agent Leaderboard](https://live-swe-agent.github.io/) |
| Sonar Foundation | Dec 2025 | [swe-bench/experiments](https://github.com/swe-bench/experiments/tree/main/evaluation/verified/20251205_sonar-foundation-agent_claude-opus-4-5) | [GitHub README](https://github.com/AutoCodeRoverSG/sonar-foundation-agent) |

### `list` — List benchmark instances

```bash
node dist/cli.js list
```

### Resuming an interrupted run

If the benchmark is interrupted (network error, crash, etc.), resume without losing progress:

```bash
node dist/cli.js run --resume results/swebench-2026-03-22.jsonl
```

This reads the existing JSONL, skips completed instances, and appends new results to the same file.

## Adding a New Agent

This harness is agent-agnostic — bring your own coding agent and benchmark it on the same tasks.

### Agents we'd love to see benchmarked

- **Cursor** — AI-first code editor
- **Augment Code** — AI coding assistant
- **Codex CLI** — OpenAI's coding agent
- **Gemini CLI** — Google's coding agent
- **Your own agent** — any CLI that can edit code

### How to add an adapter

1. Create `src/agents/your-agent.ts` implementing the `AgentAdapter` interface
2. Register it in `src/agents/registry.ts`
3. Run: `node dist/cli.js run --agent your-agent --no-vexp`

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for a step-by-step guide with code templates.

### Submit your results

Run the benchmark, then open a PR with:
- Your adapter code
- Results JSONL
- Comparison: `node dist/cli.js compare your-results.jsonl`

We'll add your agent to the leaderboard.

## Architecture

```
src/
├── cli.ts                  # CLI entry point
├── types.ts                # Shared type definitions
├── agents/
│   ├── adapter.ts          # AgentAdapter interface
│   ├── claude-code.ts      # Claude Code adapter (with real-time cost limit)
│   └── registry.ts         # Agent lookup
├── harness/
│   ├── orchestrator.ts     # Main benchmark loop (indexes once per repo)
│   ├── loader.ts           # Load instances from JSONL
│   └── repo.ts             # Git operations (clone, reset, patch capture, cleanup)
├── vexp/
│   ├── ensure.ts           # Auto-detect/install vexp, license check, npm version check
│   ├── enhancer.ts         # vexp setup per repo (CLAUDE.md, hooks, MCP config, index)
│   ├── daemon.ts           # vexp daemon lifecycle (process group cleanup)
│   └── metrics.ts          # vexp metrics collection from SQLite
├── evaluate/
│   └── evaluator.ts        # Docker + lightweight evaluation
├── metrics/
│   ├── stream-parser.ts    # Parse Claude stream-json output
│   └── pricing.ts          # Model pricing table
├── compare/
│   └── compare.ts          # Multi-agent comparison + terminal table
└── ui/
    ├── banner.ts           # CLI branding + promo box
    └── progress.ts         # Progress bar (X patched, ETA)
```

## Task Selection

The 100-task subset is selected via stratified sampling from the full 500-task SWE-bench Verified dataset:

- **100% repository coverage** — all 12 repositories represented proportionally
- **Complexity-aligned** — subset median complexity (22) matches full dataset median (23)
- **Outlier filtering** — complexity ceiling ≤ 250 removes extreme outliers (~1% of instances)
- **Statistical power** — 100 instances provide a ±8.7% margin of error at 95% confidence

Comparison with external agents uses their per-instance resolution data on the exact same 100 tasks — no extrapolation needed.

See [docs/TASK_SELECTION.md](docs/TASK_SELECTION.md) for the full methodology and repository distribution table.

## Results Format

Results are written as JSONL (one JSON object per line). Each entry includes:

| Field | Description |
|-------|-------------|
| `instanceId` | SWE-bench instance identifier |
| `repo` | GitHub repository |
| `model` | Model used |
| `agent` | Agent adapter name |
| `inputTokens` / `outputTokens` | Token usage |
| `costUsd` | Estimated cost for this instance |
| `numTurns` | Agentic turns taken |
| `durationMs` | Wall-clock time |
| `modelPatch` | Git diff produced by the agent |
| `resolved` | `true` / `false` / `null` (unevaluated) |
| `vexpMetrics` | vexp-specific metrics (null if `--no-vexp`) |

## What is vexp?

[vexp](https://vexp.dev) is a context-aware code intelligence layer for AI coding agents. It pre-indexes your codebase into a semantic graph, then delivers precisely ranked context in a single MCP call.

**Why it matters for benchmarks:**
- Fewer agentic turns → lower cost per task
- Better context → higher resolution rate
- Works with any agent that supports MCP

In this benchmark, vexp-augmented Claude Code achieves **73% pass@1 at $0.67/task** — the best cost-efficiency among all tested agents.

## Try it yourself

Run the benchmark on your coding agent in under 10 minutes:

```bash
git clone https://github.com/nicobailon/vexp-swe-bench.git
cd vexp-swe-bench && ./setup.sh
source .venv/bin/activate
node dist/cli.js run
```

Use code **BENCHMARK** at [vexp.dev/#pricing](https://vexp.dev/#pricing) for 14 days of vexp Pro — free.

## License

MIT — see [LICENSE](LICENSE).

---

If this benchmark is useful, please star the repo — it helps others find it.

Built by [vexp.dev](https://vexp.dev)
