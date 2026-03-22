import type { AgentAdapter, AgentRunOptions, AgentRunResult } from "./adapter.js";
/**
 * Claude Code agent adapter.
 *
 * Spawns the `claude` CLI in headless mode with `--output-format stream-json`,
 * parses the structured output for token/cost metrics.
 * Implements cost limit by monitoring the stream in real-time.
 */
export declare class ClaudeCodeAdapter implements AgentAdapter {
    name: string;
    run(opts: AgentRunOptions): Promise<AgentRunResult>;
}
