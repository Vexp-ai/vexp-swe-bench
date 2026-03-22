export declare class Progress {
    private total;
    private current;
    private patched;
    private startTime;
    constructor(total: number);
    tick(instanceId: string, hasPatch: boolean): void;
    private renderBar;
}
