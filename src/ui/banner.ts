import chalk from "chalk";

const VEXP_BLUE = chalk.hex("#4c78a8");
const VEXP_PURPLE = chalk.hex("#7c3aed");
const VEXP_DIM = chalk.dim;

const LOGO = `
  ██╗   ██╗███████╗██╗  ██╗██████╗
  ██║   ██║██╔════╝╚██╗██╔╝██╔══██╗
  ██║   ██║█████╗   ╚███╔╝ ██████╔╝
  ╚██╗ ██╔╝██╔══╝   ██╔██╗ ██╔═══╝
   ╚████╔╝ ███████╗██╔╝ ██╗██║
    ╚═══╝  ╚══════╝╚═╝  ╚═╝╚═╝`;

export function printBanner(): void {
  console.log(VEXP_PURPLE(LOGO));
  console.log(VEXP_BLUE("  SWE-bench Verified Harness"));
  console.log(VEXP_DIM("  Evaluate coding agents on real-world GitHub issues\n"));
}

export function printSeparator(label?: string): void {
  if (label) {
    console.log(VEXP_BLUE(`\n═══ ${label} ═══`));
  } else {
    console.log(VEXP_BLUE("\n" + "═".repeat(60)));
  }
}

export function printInstanceHeader(instanceId: string, index: number, total: number): void {
  console.log(VEXP_BLUE(`\n──── [${index + 1}/${total}] ${instanceId} ────`));
}

export function printResult(label: string, value: string): void {
  console.log(`  ${VEXP_DIM("→")} ${label}: ${VEXP_BLUE(value)}`);
}

export function printSuccess(msg: string): void {
  console.log(chalk.green(`  ✓ ${msg}`));
}

export function printWarning(msg: string): void {
  console.log(chalk.yellow(`  ⚠ ${msg}`));
}

export function printError(msg: string): void {
  console.log(chalk.red(`  ✗ ${msg}`));
}

export function printPromoBox(): void {
  const border = VEXP_PURPLE("  ┌" + "─".repeat(54) + "┐");
  const bottom = VEXP_PURPLE("  └" + "─".repeat(54) + "┘");
  const line = (text: string) => {
    const pad = 54 - text.length;
    return VEXP_PURPLE("  │") + "  " + text + " ".repeat(Math.max(0, pad - 2)) + VEXP_PURPLE("│");
  };

  console.log();
  console.log(border);
  console.log(line(chalk.bold("vexp Pro or Team plan required to run benchmarks")));
  console.log(line(""));
  console.log(line("Use code " + chalk.bold.green("BENCHMARK") + " at checkout for"));
  console.log(line(chalk.bold("14 days of Pro") + " — completely free."));
  console.log(line(""));
  console.log(line(VEXP_BLUE("→ https://vexp.dev/#pricing")));
  console.log(bottom);
  console.log();
}

export function printSummary(total: number, patched: number, costUsd: number, outputPath: string): void {
  const avgCost = total > 0 ? costUsd / total : 0;
  console.log(VEXP_PURPLE("\n" + "═".repeat(60)));
  console.log(VEXP_PURPLE("  BENCHMARK COMPLETE"));
  console.log(VEXP_PURPLE("═".repeat(60)));
  console.log(`  Instances:  ${VEXP_BLUE(String(total))}`);
  console.log(`  Patched:    ${chalk.green(String(patched))} / ${total}`);
  console.log(`  Total cost: ${VEXP_BLUE("$" + costUsd.toFixed(2))}`);
  console.log(`  Avg $/task: ${VEXP_BLUE("$" + avgCost.toFixed(2))}`);
  console.log(VEXP_PURPLE("═".repeat(60)));
  console.log();
  console.log(VEXP_DIM("  To evaluate resolution rates, run:"));
  console.log(`  ${VEXP_BLUE(`node dist/cli.js evaluate ${outputPath} --dataset swebench-verified-full.jsonl`)}`);
  console.log();
}
