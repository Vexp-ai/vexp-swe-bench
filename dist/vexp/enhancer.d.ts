import { VexpDaemon } from "./daemon.js";
/**
 * Set up vexp for a repo (called ONCE per repo, not per task).
 * Cleans stale state, writes config files, and indexes.
 * Returns the MCP config path.
 */
export declare function setupVexpRepo(repoPath: string): Promise<string>;
/**
 * Start the vexp daemon for a single task.
 * Call this per-instance, stop it after each run.
 */
export declare function startVexpDaemon(repoPath: string): Promise<VexpDaemon>;
/**
 * Tear down vexp files (for clean baseline runs or post-run cleanup).
 */
export declare function teardownVexp(repoPath: string): Promise<void>;
