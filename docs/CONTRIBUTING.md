# Contributing

We welcome contributions, especially **new agent adapters** that expand the set of coding agents benchmarked on SWE-bench Verified.

## Adding a New Agent Adapter

Each agent adapter lives in `src/agents/` and implements the `AgentAdapter` interface.

### Step 1: Create the adapter file

Create `src/agents/your-agent.ts`:

```typescript
import type { AgentAdapter, AgentRunOptions, AgentRunResult } from "./adapter.js";

export class YourAgentAdapter implements AgentAdapter {
  name = "your-agent";

  async run(opts: AgentRunOptions): Promise<AgentRunResult> {
    const startMs = Date.now();

    // Spawn your agent CLI
    // opts.prompt        — the problem statement to send
    // opts.cwd           — the repo directory to work in
    // opts.model         — model identifier (if applicable)
    // opts.maxTurns      — maximum turns (default: 250)
    // opts.costLimitUsd  — max cost per instance in USD (default: 3)
    // opts.timeoutMs     — kill after this many ms (0 = no timeout)

    // ... your implementation here ...

    const durationMs = Date.now() - startMs;

    return {
      metrics: {
        inputTokens: 0,        // populate if available
        outputTokens: 0,       // populate if available
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        costUsd: 0,            // populate if available
        numTurns: 0,           // populate if available
        durationMs,
        toolCalls: {},         // populate if available
      },
      rawOutput: "",           // full stdout for debugging
    };
  }
}
```

**Key points:**
- The adapter only runs the agent. Patch capture (git diff) is handled by the harness.
- Metrics are best-effort — fill in what your agent exposes.
- The agent is given a repo directory at a specific commit. It should modify files in-place.
- `costLimitUsd` should be enforced by your adapter (kill the agent if cost exceeds the limit).

### Step 2: Register the adapter

Add your adapter to `src/agents/registry.ts`:

```typescript
import { YourAgentAdapter } from "./your-agent.js";

const adapters: Record<string, () => AgentAdapter> = {
  "claude-code": () => new ClaudeCodeAdapter(),
  "your-agent": () => new YourAgentAdapter(),  // add this
};
```

### Step 3: Test it

```bash
# Build
npm run build

# Run on a single instance
node dist/cli.js run --agent your-agent --instances django__django-11099 --no-vexp

# Run the full benchmark
node dist/cli.js run --agent your-agent --no-vexp
```

### Step 4: Submit a PR

Include:
- The adapter file
- Updated registry
- A brief description of the agent in the PR

## Running Tests

```bash
npm run build      # TypeScript compilation
npm run lint       # Type checking without emit
```

## Reporting Results

If you run the benchmark with a new agent, we'd love to see the results. Include:
- The raw JSONL output
- Generated plots (`node dist/cli.js plot results/your-file.jsonl`)
- The leaderboard comparison (`node dist/cli.js leaderboard results/your-file.jsonl`)

## Code Style

- TypeScript with strict mode
- ESM imports (`.js` extensions)
- No unnecessary abstractions — keep it simple
