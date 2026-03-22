import { spawn } from "node:child_process";
import { join } from "node:path";
import { connect } from "node:net";
import { existsSync } from "node:fs";
import { printSuccess, printWarning } from "../ui/banner.js";
/**
 * Manages the vexp daemon lifecycle for benchmark runs.
 */
export class VexpDaemon {
    repoPath;
    proc = null;
    constructor(repoPath) {
        this.repoPath = repoPath;
    }
    async start() {
        console.log("  Starting vexp daemon...");
        this.proc = spawn("npx", ["-y", "vexp-cli", "daemon", "--workspace", this.repoPath], {
            stdio: ["ignore", "pipe", "pipe"],
            env: { ...process.env, VEXP_WORKSPACE: this.repoPath },
            detached: true, // create process group so we can kill all children
        });
        const errChunks = [];
        this.proc.stderr?.on("data", (chunk) => errChunks.push(chunk));
        this.proc.on("error", (err) => {
            printWarning(`Daemon error: ${err.message}`);
        });
        this.proc.on("exit", (code) => {
            if (code !== 0 && code !== null) {
                const stderr = Buffer.concat(errChunks).toString("utf-8").slice(0, 200);
                printWarning(`Daemon exited with code ${code}: ${stderr}`);
            }
        });
        // Wait for daemon to be ready
        const ready = await this.waitForReady(120_000);
        if (ready) {
            printSuccess("vexp daemon ready");
        }
        else {
            printWarning("Daemon did not become ready in 120s. Continuing without daemon.");
        }
    }
    async stop() {
        if (!this.proc)
            return;
        const pid = this.proc.pid;
        // Kill the entire process group (npx + node + vexp-core)
        if (pid) {
            try {
                process.kill(-pid, "SIGTERM"); // negative PID = kill process group
            }
            catch {
                this.proc.kill("SIGTERM"); // fallback: kill just the parent
            }
        }
        else {
            this.proc.kill("SIGTERM");
        }
        await new Promise((resolve) => {
            const timer = setTimeout(() => {
                // Force kill the entire group
                if (pid) {
                    try {
                        process.kill(-pid, "SIGKILL");
                    }
                    catch { /* already dead */ }
                }
                if (this.proc && !this.proc.killed) {
                    this.proc.kill("SIGKILL");
                }
                resolve();
            }, 5000);
            this.proc.on("exit", () => {
                clearTimeout(timer);
                resolve();
            });
        });
        this.proc = null;
    }
    async withDaemon(fn) {
        await this.start();
        try {
            return await fn();
        }
        finally {
            await this.stop();
        }
    }
    async waitForReady(timeoutMs) {
        const start = Date.now();
        const socketPath = this.getSocketPath();
        while (Date.now() - start < timeoutMs) {
            // Check both socket and healthy file
            if (existsSync(socketPath) || existsSync(join(this.repoPath, ".vexp", "healthy"))) {
                const ok = await this.ping(socketPath);
                if (ok)
                    return true;
            }
            await sleep(500);
        }
        return false;
    }
    ping(socketPath) {
        return new Promise((resolve) => {
            const sock = connect(socketPath, () => {
                sock.destroy();
                resolve(true);
            });
            sock.on("error", () => {
                sock.destroy();
                resolve(false);
            });
            setTimeout(() => {
                sock.destroy();
                resolve(false);
            }, 2000);
        });
    }
    getSocketPath() {
        if (process.platform === "win32") {
            const hash = fnvHash(this.repoPath);
            return `\\\\.\\pipe\\vexp-${hash}`;
        }
        return join(this.repoPath, ".vexp", "daemon.sock");
    }
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/** FNV-1a 64-bit hash (matches vexp-core). */
function fnvHash(input) {
    let hash = BigInt("0xcbf29ce484222325");
    const prime = BigInt("0x100000001b3");
    for (let i = 0; i < input.length; i++) {
        hash ^= BigInt(input.charCodeAt(i));
        hash = (hash * prime) & BigInt("0xffffffffffffffff");
    }
    return hash.toString(16);
}
//# sourceMappingURL=daemon.js.map