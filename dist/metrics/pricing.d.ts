import type { ModelPricing } from "../types.js";
export declare const MODEL_PRICING: Record<string, ModelPricing>;
export declare function calculateCost(input: number, output: number, cacheRead: number, cacheCreation: number, model?: string): number;
