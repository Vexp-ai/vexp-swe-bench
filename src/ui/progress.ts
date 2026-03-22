import chalk from "chalk";

const VEXP_BLUE = chalk.hex("#4c78a8");

export class Progress {
  private total: number;
  private current = 0;
  private patched = 0;
  private startTime: number;

  constructor(total: number) {
    this.total = total;
    this.startTime = Date.now();
  }

  tick(instanceId: string, hasPatch: boolean): void {
    this.current++;
    if (hasPatch) this.patched++;

    const elapsed = Date.now() - this.startTime;
    const avgMs = elapsed / this.current;
    const remainingMs = avgMs * (this.total - this.current);
    const eta = formatDuration(remainingMs);

    const bar = this.renderBar(30);
    const pct = ((this.current / this.total) * 100).toFixed(0);

    process.stdout.write(
      `\r  ${bar} ${VEXP_BLUE(pct + "%")} ` +
      `(${this.current}/${this.total}) ` +
      `${chalk.green(this.patched + " patched")} ` +
      `${chalk.dim("ETA " + eta)}  `,
    );

    if (this.current === this.total) {
      process.stdout.write("\n");
    }
  }

  private renderBar(width: number): string {
    const filled = Math.round((this.current / this.total) * width);
    const empty = width - filled;
    return VEXP_BLUE("█".repeat(filled)) + chalk.dim("░".repeat(empty));
  }
}

function formatDuration(ms: number): string {
  if (ms < 0) return "--:--";
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}m`;
  return `${m}m${String(s).padStart(2, "0")}s`;
}
