import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const exec = promisify(execFile);

const BENCH_REPOS_DIR = join(process.cwd(), ".bench-repos");

/** Clone or reuse a repo, checkout the specified commit. */
export async function setupRepo(
  repoSlug: string,
  commit: string,
): Promise<{ localPath: string }> {
  mkdirSync(BENCH_REPOS_DIR, { recursive: true });

  const repoName = repoSlug.replace("/", "__");
  const localPath = join(BENCH_REPOS_DIR, repoName);

  if (!existsSync(localPath)) {
    console.log(`  Cloning ${repoSlug}...`);
    await exec("git", [
      "clone", "--depth", "1",
      `https://github.com/${repoSlug}.git`,
      localPath,
    ], { timeout: 120_000, maxBuffer: 50 * 1024 * 1024 });
  }

  // Fetch the specific commit (may not be in shallow clone)
  try {
    await exec("git", ["cat-file", "-t", commit], { cwd: localPath });
  } catch {
    console.log(`  Fetching commit ${commit.slice(0, 8)}...`);
    await exec("git", ["fetch", "--depth", "1", "origin", commit], {
      cwd: localPath,
      timeout: 120_000,
    });
  }

  await exec("git", ["checkout", commit, "--force"], { cwd: localPath });
  await exec("git", [
    "clean", "-fdx",
    "-e", ".vexp",
    "-e", ".claude",
    "-e", ".bench-mcp-config.json",
  ], { cwd: localPath });

  return { localPath };
}

/**
 * Hard-reset the repo to a specific commit, removing all changes
 * but preserving .vexp/ (index database) and .claude/.
 */
export async function resetRepo(localPath: string, baseCommit: string): Promise<void> {
  // Fetch commit if not present (shallow clone may not have it)
  try {
    await exec("git", ["cat-file", "-t", baseCommit], { cwd: localPath });
  } catch {
    console.log(`  Fetching commit ${baseCommit.slice(0, 8)}...`);
    await exec("git", ["fetch", "--depth", "1", "origin", baseCommit], {
      cwd: localPath,
      timeout: 120_000,
    });
  }

  await exec("git", ["checkout", baseCommit, "--force"], { cwd: localPath });
  await exec("git", [
    "clean", "-fdx",
    "-e", ".vexp",
    "-e", ".claude",
    "-e", ".bench-mcp-config.json",
  ], { cwd: localPath });
}

/**
 * Capture the agent's patch as a unified diff.
 * Stages everything the agent changed and returns `git diff --cached`.
 */
export async function capturePatch(localPath: string): Promise<string> {
  await exec("git", [
    "add", "-A",
    "--", ".", ":(exclude).vexp", ":(exclude).claude", ":(exclude).bench-mcp-config.json",
  ], { cwd: localPath });

  const { stdout } = await exec("git", ["diff", "--cached"], {
    cwd: localPath,
    maxBuffer: 10 * 1024 * 1024,
  });

  // Unstage so changes don't accumulate across tasks
  await exec("git", ["reset", "HEAD", "--quiet"], { cwd: localPath });

  return stdout;
}

/**
 * Full cleanup of a repo — reset all changes, remove all untracked files
 * including .vexp/, .claude/, etc. Leaves the repo in a pristine state.
 */
export async function cleanupRepo(localPath: string): Promise<void> {
  try {
    await exec("git", ["reset", "HEAD", "--quiet"], { cwd: localPath });
    await exec("git", ["checkout", ".", "--force"], { cwd: localPath });
    await exec("git", ["clean", "-fdx"], { cwd: localPath });
  } catch {
    // Best effort — repo might be in a weird state
  }
}

/**
 * Cleanup all repos in .bench-repos/ — call at startup to clear
 * residual state from crashed/interrupted previous runs.
 */
export async function cleanupAllRepos(): Promise<void> {
  if (!existsSync(BENCH_REPOS_DIR)) return;

  const dirs = readdirSync(BENCH_REPOS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => join(BENCH_REPOS_DIR, d.name));

  for (const dir of dirs) {
    if (existsSync(join(dir, ".git"))) {
      await cleanupRepo(dir);
    }
  }

  if (dirs.length > 0) {
    console.log(`  Cleaned ${dirs.length} cached repo(s) in .bench-repos/`);
  }
}
