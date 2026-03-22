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

import { calculateCost } from "./pricing.js";

export interface ParsedStream {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number;
  numTurns: number;
  toolCallSummary: Record<string, { count: number; totalResultBytes: number }>;
  responseText: string;
  filesRead: string[];
}

export function parseStreamJson(raw: string, model?: string): ParsedStream {
  const lines = raw.split("\n").filter((l) => l.trim());
  const events: StreamEvent[] = [];

  for (const line of lines) {
    try {
      events.push(JSON.parse(line) as StreamEvent);
    } catch {
      // Skip non-JSON lines
    }
  }

  const toolCalls: Array<{ tool: string; resultBytes: number }> = [];
  const filesRead: string[] = [];
  const responseParts: string[] = [];

  let totalInput = 0;
  let totalOutput = 0;
  let cacheRead = 0;
  let cacheCreation = 0;
  let numTurns = 0;

  function processToolUse(toolName: string, input: Record<string, unknown>): void {
    if (toolName === "Read" && input.file_path) {
      filesRead.push(input.file_path as string);
    }
    toolCalls.push({ tool: toolName, resultBytes: 0 });
  }

  for (const event of events) {
    if (event.type === "assistant") {
      numTurns++;

      const usage = event.message?.usage;
      if (usage) {
        totalInput += usage.input_tokens ?? 0;
        totalOutput += usage.output_tokens ?? 0;
        cacheRead += usage.cache_read_input_tokens ?? 0;
        cacheCreation += usage.cache_creation_input_tokens ?? 0;
      }

      if (event.message?.content) {
        for (const block of event.message.content) {
          if (block.type === "text" && block.text) {
            responseParts.push(block.text);
          }
          if (block.type === "tool_use") {
            processToolUse(block.name ?? "unknown", block.input ?? {});
          }
        }
      }
    }

    if (event.type === "tool_use") {
      processToolUse(event.name ?? "unknown", event.input ?? {});
    }

    if (event.type === "tool_result") {
      const lastCall = toolCalls[toolCalls.length - 1];
      if (lastCall) {
        const resultStr = typeof event.content === "string"
          ? event.content
          : JSON.stringify(event.content ?? "");
        lastCall.resultBytes = Buffer.byteLength(resultStr, "utf-8");
      }
    }

    if (event.type === "result") {
      const cost = event.total_cost_usd ?? event.result?.cost_usd;
      if (cost != null) {
        return buildResult(cost);
      }
    }
  }

  const costUsd = calculateCost(totalInput, totalOutput, cacheRead, cacheCreation, model);
  return buildResult(costUsd);

  function buildResult(costUsd: number): ParsedStream {
    const summary: Record<string, { count: number; totalResultBytes: number }> = {};
    for (const tc of toolCalls) {
      if (!summary[tc.tool]) {
        summary[tc.tool] = { count: 0, totalResultBytes: 0 };
      }
      summary[tc.tool].count++;
      summary[tc.tool].totalResultBytes += tc.resultBytes;
    }

    return {
      inputTokens: totalInput,
      outputTokens: totalOutput,
      cacheReadTokens: cacheRead,
      cacheCreationTokens: cacheCreation,
      costUsd,
      numTurns,
      toolCallSummary: summary,
      responseText: responseParts.join("\n\n"),
      filesRead: [...new Set(filesRead)],
    };
  }
}

// ── Stream JSON event types ─────────────────────────────────────────

interface UsageData {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

interface StreamEvent {
  type: string;
  message?: {
    usage?: UsageData;
    content?: Array<{ type: string; text?: string; name?: string; input?: Record<string, unknown> }>;
  };
  name?: string;
  input?: Record<string, unknown>;
  content?: unknown;
  usage?: UsageData;
  total_cost_usd?: number;
  result?: {
    usage?: UsageData;
    cost_usd?: number;
  };
}
