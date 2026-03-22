import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createInterface } from "node:readline";
import { printSuccess, printWarning, printError, printPromoBox } from "../ui/banner.js";

const exec = promisify(execFile);

const MIN_VERSION = "1.2.0";
const VALID_PLANS = ["pro", "team"];

/**
 * Ensure vexp-cli is available on the system.
 * Auto-installs from npm if not found.
 */
export async function ensureVexp(): Promise<void> {
  // Check if vexp-cli is already available
  const version = await getVexpVersion();

  if (version) {
    if (compareVersions(version, MIN_VERSION) < 0) {
      printWarning(`vexp-cli ${version} is outdated (minimum: ${MIN_VERSION}). Upgrading...`);
      await installVexp();
    } else {
      // Check if a newer version is available on npm
      const latest = await getLatestNpmVersion();
      if (latest && compareVersions(version, latest) < 0) {
        printWarning(`vexp-cli ${version} → ${latest} available. Upgrading...`);
        await installVexp();
        printSuccess(`vexp-cli ${latest} ready`);
      } else {
        printSuccess(`vexp-cli ${version} detected (latest)`);
      }
    }
    return;
  }

  // Not found — attempt auto-install
  console.log("  vexp-cli not found. Installing from npm...");
  await installVexp();

  // Verify installation
  const installed = await getVexpVersion();
  if (installed) {
    printSuccess(`vexp-cli ${installed} installed successfully`);
  } else {
    printError(
      "vexp-cli could not be installed automatically.\n" +
      "  Install it manually:  npm install -g vexp-cli\n" +
      "  Or run without vexp:  vexp-swe-bench run --no-vexp",
    );
    throw new Error("vexp-cli installation failed");
  }
}

/**
 * Ensure the user has a vexp Pro or Team license.
 * If not, shows a promo offer and prompts for a license key.
 */
export async function ensureVexpLicense(): Promise<void> {
  const plan = await getVexpPlan();

  if (plan && VALID_PLANS.includes(plan.toLowerCase())) {
    printSuccess(`vexp ${plan} plan active`);
    return;
  }

  // Free or Expired — show promo and prompt for key
  printPromoBox();

  console.log("  Once you have your license key, paste it below.");
  console.log("  (Get one free at https://vexp.dev/#pricing with code BENCHMARK)\n");

  const key = await promptForInput("  License key: ");

  if (!key.trim()) {
    printError("No license key provided. Cannot run benchmark with vexp.");
    throw new Error("vexp Pro or Team license required");
  }

  // Activate the key
  console.log("\n  Activating license...");
  try {
    await exec("npx", ["-y", "vexp-cli", "activate", key.trim()], {
      timeout: 30_000,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    printError(`Activation failed: ${msg.slice(0, 120)}`);
    throw new Error("License activation failed");
  }

  // Verify activation
  const newPlan = await getVexpPlan();
  if (newPlan && VALID_PLANS.includes(newPlan.toLowerCase())) {
    printSuccess(`vexp ${newPlan} activated! Starting benchmark...`);
  } else {
    printError("License was activated but plan is still not Pro/Team.");
    printError("Check your license at https://vexp.dev/account");
    throw new Error("vexp Pro or Team license required");
  }
}

/** Get the current vexp plan tier. Returns null if unable to determine. */
async function getVexpPlan(): Promise<string | null> {
  try {
    const { stdout } = await exec("npx", ["-y", "vexp-cli", "license", "status"], {
      timeout: 30_000,
    });
    // Parse plan tier from output (look for known plan names)
    const output = stdout.toLowerCase();
    if (output.includes("team")) return "Team";
    if (output.includes("pro")) return "Pro";
    if (output.includes("expired")) return "Expired";
    if (output.includes("free")) return "Free";
    return null;
  } catch {
    return null;
  }
}

/** Prompt the user for a single line of input via stdin. */
function promptForInput(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/** Query npm registry for the latest published vexp-cli version. Non-blocking. */
async function getLatestNpmVersion(): Promise<string | null> {
  try {
    const { stdout } = await exec("npm", ["view", "vexp-cli", "version"], {
      timeout: 10_000,
    });
    const match = stdout.trim().match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/** Try to get the installed vexp-cli version. Returns null if not found. */
async function getVexpVersion(): Promise<string | null> {
  // Try global install first
  try {
    const { stdout } = await exec("vexp-cli", ["--version"], { timeout: 10_000 });
    const match = stdout.trim().match(/(\d+\.\d+\.\d+)/);
    if (match) return match[1];
  } catch {
    // not installed globally
  }
  // Fallback to npx (may use cached version)
  try {
    const { stdout } = await exec("npx", ["-y", "vexp-cli", "--version"], {
      timeout: 30_000,
    });
    const match = stdout.trim().match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Install or upgrade vexp-cli.
 * Tries global install first, falls back to clearing npx cache and pulling @latest.
 */
async function installVexp(): Promise<void> {
  // Try global install
  try {
    await exec("npm", ["install", "-g", "vexp-cli@latest"], {
      timeout: 60_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return;
  } catch {
    // Global install failed (EACCES etc.) — fall back to npx cache refresh
  }

  // Clear stale npx cache and force latest download
  try {
    await exec("npx", ["-y", "vexp-cli@latest", "--version"], {
      timeout: 60_000,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    printWarning(`Update failed (${msg.slice(0, 80)}). Using current version.`);
  }
}

/** Compare semver strings. Returns -1 if a < b, 0 if equal, 1 if a > b. */
function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return -1;
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return 1;
  }
  return 0;
}
