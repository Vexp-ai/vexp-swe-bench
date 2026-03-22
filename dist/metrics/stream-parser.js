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
export function parseStreamJson(raw, model) {
    const lines = raw.split("\n").filter((l) => l.trim());
    const events = [];
    for (const line of lines) {
        try {
            events.push(JSON.parse(line));
        }
        catch {
            // Skip non-JSON lines
        }
    }
    const toolCalls = [];
    const filesRead = [];
    const responseParts = [];
    let totalInput = 0;
    let totalOutput = 0;
    let cacheRead = 0;
    let cacheCreation = 0;
    let numTurns = 0;
    function processToolUse(toolName, input) {
        if (toolName === "Read" && input.file_path) {
            filesRead.push(input.file_path);
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
    function buildResult(costUsd) {
        const summary = {};
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
//# sourceMappingURL=stream-parser.js.map