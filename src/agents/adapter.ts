/**
 * Agent adapter interface.
 *
 * Each supported coding agent (Claude Code, Aider, Codex, etc.) implements
 * this interface. The harness calls `run()` and captures the git diff
 * separately — the adapter only needs to execute the agent.
 */

export interface AgentRunOptions {
  /** Problem statement / prompt to send to the agent. */
  prompt: string;
  /** Working directory (the cloned repo). */
  cwd: string;
  /** Model identifier (e.g. "claude-sonnet-4-6"). */
  model: string;
  /** Maximum agentic turns before stopping. */
  maxTurns: number;
  /** Max cost per instance in USD (0 = unlimited). */
  costLimitUsd: number;
  /** Thinking token budget for extended thinking (0 = disabled). */
  thinkingBudget: number;
  /** Kill the agent after this many milliseconds (0 = no timeout). */
  timeoutMs: number;
  /** Additional environment variables. */
  env?: Record<string, string>;
  /** Path to MCP config JSON (for agents that support MCP). */
  mcpConfigPath?: string;
  /** Tool whitelist (agent-specific, e.g. Claude Code's --allowedTools). */
  allowedTools?: string[];
}

export interface AgentRunResult {
  metrics: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
    costUsd: number;
    numTurns: number;
    durationMs: number;
    toolCalls: Record<string, number>;
  };
  /** Full stdout from the agent process (for post-processing). */
  rawOutput: string;
}

export interface AgentAdapter {
  /** Human-readable name, e.g. "claude-code", "aider". */
  name: string;
  /** Execute the agent on a task. Patch capture is handled by the harness. */
  run(opts: AgentRunOptions): Promise<AgentRunResult>;
}
