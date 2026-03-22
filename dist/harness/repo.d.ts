/** Clone or reuse a repo, checkout the specified commit. */
export declare function setupRepo(repoSlug: string, commit: string): Promise<{
    localPath: string;
}>;
/**
 * Hard-reset the repo to a specific commit, removing all changes
 * but preserving .vexp/ (index database) and .claude/.
 */
export declare function resetRepo(localPath: string, baseCommit: string): Promise<void>;
/**
 * Capture the agent's patch as a unified diff.
 * Stages everything the agent changed and returns `git diff --cached`.
 */
export declare function capturePatch(localPath: string): Promise<string>;
/**
 * Full cleanup of a repo — reset all changes, remove all untracked files
 * including .vexp/, .claude/, etc. Leaves the repo in a pristine state.
 */
export declare function cleanupRepo(localPath: string): Promise<void>;
/**
 * Cleanup all repos in .bench-repos/ — call at startup to clear
 * residual state from crashed/interrupted previous runs.
 */
export declare function cleanupAllRepos(): Promise<void>;
