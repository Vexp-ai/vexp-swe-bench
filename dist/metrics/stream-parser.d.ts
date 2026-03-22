/**
 * Parse Claude Code's stream-json output into structured metrics.
 *
 * Each line is a JSON object with a "type" field:
 * - "system"      — system info
 * - "assistant"   — Claude's message with usage
 * - "tool_use"    — tool call
 * - "tool_result" — tool result
 * - "result"      — final summary with total usage
 */
export interface ParsedStream {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
    costUsd: number;
    numTurns: number;
    toolCallSummary: Record<string, {
        count: number;
        totalResultBytes: number;
    }>;
    responseText: string;
    filesRead: string[];
}
export declare function parseStreamJson(raw: string, model?: string): ParsedStream;
