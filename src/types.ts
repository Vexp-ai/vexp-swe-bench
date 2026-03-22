// ── SWE-bench instance (matches HuggingFace dataset schema) ─────────

export interface SwebenchInstance {
  instance_id: string;             // e.g. "django__django-11099"
  repo: string;                    // e.g. "django/django"
  base_commit: string;
  problem_statement: string;       // → prompt for the agent
  hints_text: string;
  test_patch: string;              // diff that adds/modifies verification tests
  patch: string;                   // gold solution (never shown to the agent)
  FAIL_TO_PASS: string;            // JSON-stringified array of test names
  PASS_TO_PASS: string;            // JSON-stringified array of test names
  environment_setup_commit: string;
  version: string;
}

// ── Run configuration ───────────────────────────────────────────────

export interface RunConfig {
  model: string;                   // e.g. "claude-sonnet-4-6"
  agent: string;                   // adapter name, default "claude-code"
  maxTurns: number;                // max agentic turns per run (default: 250)
  costLimitUsd: number;            // max cost per instance in USD (default: 3, 0 = unlimited)
  thinkingBudget: number;          // thinking token budget (0 = disabled)
  timeoutSeconds: number;          // per-command timeout in seconds (default: 0 = no global timeout)
  instanceIds: string[];           // which to run, ["*"] = all in subset
  dataJsonl: string;               // path to instances JSONL (default: bundled 200)
  outputDir: string;
  useVexp: boolean;                // default true — set false with --no-vexp
  dryRun: boolean;
  skipEvaluation: boolean;
  resumeFrom?: string;             // path to existing JSONL to resume from
}

// ── Per-run result (written to JSONL) ───────────────────────────────

export interface RunResult {
  instanceId: string;
  repo: string;
  timestamp: string;               // ISO 8601
  commitHash: string;
  model: string;
  agent: string;

  // Token metrics
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number;

  // Execution metrics
  numTurns: number;
  durationMs: number;

  // Tool usage: tool name → call count
  toolCalls: Record<string, number>;

  // Output
  modelPatch: string;              // git diff captured after agent runs
  resolved: boolean | null;        // null = not yet evaluated

  // vexp-specific (null if --no-vexp)
  vexpMetrics: VexpMetrics | null;
}

// ── vexp-internal metrics ───────────────────────────────────────────

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

// ── Leaderboard ─────────────────────────────────────────────────────

export interface LeaderboardData {
  lastUpdated: string;
  fullSetSize: number;
  subsetSize: number;
  entries: LeaderboardEntry[];
}

export interface LeaderboardEntry {
  system: string;
  score: number;                   // % on full set
  subsetScore?: number;            // % on our subset (if available)
  date: string;
  source: string;                  // URL to paper/blog
  isOurs?: boolean;
  selfReported?: boolean;          // not independently verified (e.g. vendor blog)
  // Cost data (null if not reported by the system)
  totalCost?: number | null;       // total $ for all 500 tasks
  instanceCost?: number | null;    // avg $ per task
  instanceCalls?: number | null;   // avg API calls per task
}

// ── Token pricing (for cost calculation) ────────────────────────────

export interface ModelPricing {
  inputPerMTok: number;
  outputPerMTok: number;
  cacheReadPerMTok: number;
  cacheWritePerMTok: number;
}
