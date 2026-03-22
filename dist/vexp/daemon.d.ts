/**
 * Manages the vexp daemon lifecycle for benchmark runs.
 */
export declare class VexpDaemon {
    private repoPath;
    private proc;
    constructor(repoPath: string);
    start(): Promise<void>;
    stop(): Promise<void>;
    withDaemon<T>(fn: () => Promise<T>): Promise<T>;
    private waitForReady;
    private ping;
    private getSocketPath;
}
