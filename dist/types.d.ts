export interface SwebenchInstance {
    instance_id: string;
    repo: string;
    base_commit: string;
    problem_statement: string;
    hints_text: string;
    test_patch: string;
    patch: string;
    FAIL_TO_PASS: string;
    PASS_TO_PASS: string;
    environment_setup_commit: string;
    version: string;
}
export interface RunConfig {
    model: string;
    agent: string;
    maxTurns: number;
    costLimitUsd: number;
    thinkingBudget: number;
    timeoutSeconds: number;
    instanceIds: string[];
    dataJsonl: string;
    outputDir: string;
    useVexp: boolean;
    dryRun: boolean;
    skipEvaluation: boolean;
    resumeFrom?: string;
}
export interface RunResult {
    instanceId: string;
    repo: string;
    timestamp: string;
    commitHash: string;
    model: string;
    agent: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
    costUsd: number;
    numTurns: number;
    durationMs: number;
    toolCalls: Record<string, number>;
    modelPatch: string;
    resolved: boolean | null;
    vexpMetrics: VexpMetrics | null;
}
export interface VexpMetrics {
    tokenBudget: {
        total: number;
        used: number;
        saved: number;
        savingPct: number;
    };
    graphStats: {
        nodesAnalyzed: number;
        edgesTraversed: number;
        queryTimeMs: number;
    };
    intent: string;
    pivotCount: number;
    supportingCount: number;
}
export interface LeaderboardData {
    lastUpdated: string;
    fullSetSize: number;
    subsetSize: number;
    entries: LeaderboardEntry[];
}
export interface LeaderboardEntry {
    system: string;
    score: number;
    subsetScore?: number;
    date: string;
    source: string;
    isOurs?: boolean;
    selfReported?: boolean;
    totalCost?: number | null;
    instanceCost?: number | null;
    instanceCalls?: number | null;
}
export interface ModelPricing {
    inputPerMTok: number;
    outputPerMTok: number;
    cacheReadPerMTok: number;
    cacheWritePerMTok: number;
}
