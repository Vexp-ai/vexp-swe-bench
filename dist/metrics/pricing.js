export const MODEL_PRICING = {
    "claude-sonnet-4-5-20250514": { inputPerMTok: 3, outputPerMTok: 15, cacheReadPerMTok: 0.30, cacheWritePerMTok: 3.75 },
    "claude-sonnet-4-6": { inputPerMTok: 3, outputPerMTok: 15, cacheReadPerMTok: 0.30, cacheWritePerMTok: 3.75 },
    "claude-haiku-4-5-20251001": { inputPerMTok: 0.80, outputPerMTok: 4, cacheReadPerMTok: 0.08, cacheWritePerMTok: 1 },
    "claude-opus-4-5-20251101": { inputPerMTok: 5, outputPerMTok: 25, cacheReadPerMTok: 0.50, cacheWritePerMTok: 6.25 },
    "claude-opus-4-5": { inputPerMTok: 5, outputPerMTok: 25, cacheReadPerMTok: 0.50, cacheWritePerMTok: 6.25 },
    "claude-opus-4-6": { inputPerMTok: 5, outputPerMTok: 25, cacheReadPerMTok: 0.50, cacheWritePerMTok: 6.25 },
};
export function calculateCost(input, output, cacheRead, cacheCreation, model) {
    const pricing = MODEL_PRICING[model ?? ""] ?? MODEL_PRICING["claude-sonnet-4-6"];
    return ((input / 1_000_000) * pricing.inputPerMTok +
        (output / 1_000_000) * pricing.outputPerMTok +
        (cacheRead / 1_000_000) * pricing.cacheReadPerMTok +
        (cacheCreation / 1_000_000) * pricing.cacheWritePerMTok);
}
//# sourceMappingURL=pricing.js.map