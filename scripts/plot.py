#!/usr/bin/env python3
"""Generate SWE-bench benchmark charts for vexp-swe-bench results."""

import json
import os
from collections import defaultdict

import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np
import seaborn as sns

# ── vexp brand colors ────────────────────────────────────────────────

VEXP_BLUE = "#4c78a8"
VEXP_PURPLE = "#7c3aed"
VEXP_GREEN = "#2d8a4e"
VEXP_GRAY = "#6b7280"
VEXP_ORANGE = "#f59e0b"
BASELINE_COLOR = "#94a3b8"
EXTERNAL_COLORS = ["#e45756", "#59a14f", "#edc948", "#b07aa1", "#76b7b2"]

FIG_HEIGHT = 8


def load_results(path):
    """Load JSONL results into a list of dicts."""
    rows = []
    with open(path) as f:
        for line in f:
            if line.strip():
                rows.append(json.loads(line))
    return rows


def load_external_agent(name, data_dir):
    """Load external agent resolved IDs."""
    path = os.path.join(data_dir, "external", "%s-resolved.json" % name)
    if not os.path.exists(path):
        return None
    with open(path) as f:
        return json.load(f)


def short_id(iid):
    """Shorten instance_id for chart labels."""
    return iid.replace("__", "-").split("-", 1)[-1] if "__" in iid else iid


def _subtitle(rows):
    model = rows[0].get("model", "unknown") if rows else "unknown"
    agent = rows[0].get("agent", "unknown") if rows else "unknown"
    n_inst = len(set(r["instanceId"] for r in rows))
    return "%s + %s  ·  %d instances" % (agent, model, n_inst)


def _save(fig, output_dir, name, dpi):
    path = os.path.join(output_dir, name)
    fig.savefig(path, dpi=dpi, bbox_inches="tight", pad_inches=0.3)
    plt.close(fig)
    print("  " + path)


def _despine(ax):
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)


# ── Single mode charts ──────────────────────────────────────────────

def plot_pass_rate(rows, output_dir, dpi):
    by_repo = defaultdict(lambda: {"total": 0, "resolved": 0})
    for r in rows:
        by_repo[r["repo"]]["total"] += 1
        if r.get("resolved") is True:
            by_repo[r["repo"]]["resolved"] += 1

    total = len(rows)
    resolved = sum(1 for r in rows if r.get("resolved") is True)
    overall_pct = resolved / total * 100 if total > 0 else 0

    repos = sorted(by_repo.keys())
    repo_pcts = [by_repo[r]["resolved"] / by_repo[r]["total"] * 100 for r in repos]
    repo_labels = [r.split("/")[-1] for r in repos]

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, FIG_HEIGHT),
                                     gridspec_kw={"width_ratios": [1, 2.5]})
    fig.suptitle("SWE-bench Verified — Pass@1 Resolution Rate\n" + _subtitle(rows),
                 fontsize=14, fontweight="bold")

    ax1.bar("Overall", overall_pct, color=VEXP_BLUE, alpha=0.92, width=0.5,
            edgecolor="white", linewidth=0.5)
    ax1.text(0, overall_pct + 1.5, "%.1f%%" % overall_pct, ha="center",
             fontsize=14, fontweight="bold", color=VEXP_BLUE)
    ax1.set_ylim(0, 100)
    ax1.set_ylabel("Pass@1 (%)", fontsize=12)
    ax1.set_title("Overall", fontsize=12, fontweight="bold")
    _despine(ax1)

    x = np.arange(len(repos))
    ax2.bar(x, repo_pcts, color=VEXP_BLUE, alpha=0.92, edgecolor="white", linewidth=0.5)
    for j, pct in enumerate(repo_pcts):
        ax2.text(j, pct + 1.5, "%.0f%%" % pct, ha="center", fontsize=9,
                 fontweight="bold", color=VEXP_BLUE)
        count = by_repo[repos[j]]
        ax2.text(j, -3, "%d/%d" % (count["resolved"], count["total"]),
                 ha="center", fontsize=8, color=VEXP_GRAY)

    ax2.set_xticks(x)
    ax2.set_xticklabels(repo_labels, rotation=35, ha="right", fontsize=9)
    ax2.set_ylim(0, 100)
    ax2.set_title("Per Repository", fontsize=12, fontweight="bold")
    _despine(ax2)

    fig.subplots_adjust(top=0.88, bottom=0.15)
    _save(fig, output_dir, "01-pass-rate.png", dpi)


def plot_cost(rows, output_dir, dpi):
    by_inst = defaultdict(list)
    for r in rows:
        by_inst[r["instanceId"]].append(r)

    instances = sorted(by_inst.keys(),
                       key=lambda iid: np.mean([r["costUsd"] for r in by_inst[iid]]),
                       reverse=True)

    costs = [np.mean([r["costUsd"] for r in by_inst[iid]]) for iid in instances]
    resolved = [any(r.get("resolved") for r in by_inst[iid]) for iid in instances]
    colors = [VEXP_GREEN if res else "#e45756" for res in resolved]
    labels = [short_id(iid) for iid in instances]

    fig, ax = plt.subplots(figsize=(max(12, len(instances) * 0.8), FIG_HEIGHT))
    x = np.arange(len(instances))

    ax.bar(x, costs, color=colors, alpha=0.85, edgecolor="white", linewidth=0.5)

    for j, cost in enumerate(costs):
        ax.text(j, cost + 0.005, "$%.3f" % cost, ha="center", fontsize=7,
                rotation=45, color=colors[j])

    ax.set_xticks(x)
    ax.set_xticklabels(labels, rotation=45, ha="right", fontsize=7)
    ax.set_ylabel("Cost ($)", fontsize=12)
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: "$%.2f" % v))
    ax.set_title("Cost per Instance (green = resolved, red = unresolved)\n" + _subtitle(rows),
                 fontsize=13, fontweight="bold")
    _despine(ax)

    total_cost = sum(costs)
    ax.annotate("Total: $%.2f" % total_cost, xy=(0.95, 0.95), xycoords="axes fraction",
                fontsize=12, fontweight="bold", color=VEXP_BLUE, ha="right",
                bbox=dict(boxstyle="round,pad=0.4", facecolor="white",
                          edgecolor=VEXP_BLUE, alpha=0.9))

    _save(fig, output_dir, "02-cost-per-instance.png", dpi)


def plot_dashboard(rows, output_dir, dpi):
    fig, axes = plt.subplots(2, 2, figsize=(12, FIG_HEIGHT + 2))
    fig.suptitle("SWE-bench Verified — Performance Dashboard\n" + _subtitle(rows),
                 fontsize=14, fontweight="bold")

    total = len(rows)
    resolved = sum(1 for r in rows if r.get("resolved") is True)

    ax = axes[0, 0]
    pct = resolved / total * 100 if total > 0 else 0
    ax.bar("Pass@1", pct, color=VEXP_BLUE, alpha=0.92, width=0.5)
    ax.text(0, pct + 2, "%.1f%%" % pct, ha="center", fontsize=16,
            fontweight="bold", color=VEXP_BLUE)
    ax.set_ylim(0, 100)
    ax.set_title("Resolution Rate", fontsize=12, fontweight="bold")
    _despine(ax)

    ax = axes[0, 1]
    avg_cost = np.mean([r["costUsd"] for r in rows])
    ax.bar("Avg Cost", avg_cost, color=VEXP_PURPLE, alpha=0.92, width=0.5)
    ax.text(0, avg_cost * 1.1, "$%.3f" % avg_cost, ha="center", fontsize=14,
            fontweight="bold", color=VEXP_PURPLE)
    ax.set_title("Avg Cost per Instance", fontsize=12, fontweight="bold")
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: "$%.2f" % v))
    _despine(ax)

    ax = axes[1, 0]
    avg_dur = np.mean([r["durationMs"] / 1000 for r in rows])
    ax.bar("Avg Duration", avg_dur, color=VEXP_BLUE, alpha=0.92, width=0.5)
    ax.text(0, avg_dur * 1.1, "%.0fs" % avg_dur, ha="center", fontsize=14,
            fontweight="bold", color=VEXP_BLUE)
    ax.set_title("Avg Duration", fontsize=12, fontweight="bold")
    ax.set_ylabel("Seconds")
    _despine(ax)

    ax = axes[1, 1]
    avg_turns = np.mean([r["numTurns"] for r in rows])
    ax.bar("Avg Turns", avg_turns, color=VEXP_PURPLE, alpha=0.92, width=0.5)
    ax.text(0, avg_turns * 1.1, "%.1f" % avg_turns, ha="center", fontsize=14,
            fontweight="bold", color=VEXP_PURPLE)
    ax.set_title("Avg Agentic Turns", fontsize=12, fontweight="bold")
    _despine(ax)

    fig.subplots_adjust(top=0.88, bottom=0.06, hspace=0.35)
    _save(fig, output_dir, "03-dashboard.png", dpi)


def plot_resolution_heatmap(rows, output_dir, dpi):
    by_repo = defaultdict(list)
    for r in rows:
        by_repo[r["repo"]].append(r)

    repos = sorted(by_repo.keys())
    if not repos:
        return

    fig, ax = plt.subplots(figsize=(max(14, len(rows) * 0.15), max(4, len(repos) * 1.2)))

    y_labels = []
    matrix = []
    for repo in repos:
        instances = sorted(by_repo[repo], key=lambda r: r["instanceId"])
        row = [1 if r.get("resolved") is True else (0 if r.get("resolved") is False else 0.5)
               for r in instances]
        matrix.append(row)
        y_labels.append(repo.split("/")[-1])

    max_len = max(len(r) for r in matrix)
    for row in matrix:
        row.extend([-1] * (max_len - len(row)))

    cmap = plt.cm.colors.ListedColormap(["#f3f4f6", "#e45756", "#fbbf24", VEXP_GREEN])
    bounds = [-1.5, -0.5, 0.25, 0.75, 1.5]
    norm = plt.cm.colors.BoundaryNorm(bounds, cmap.N)

    ax.imshow(matrix, cmap=cmap, norm=norm, aspect="auto", interpolation="nearest")
    ax.set_yticks(range(len(y_labels)))
    ax.set_yticklabels(y_labels, fontsize=10)
    ax.set_xlabel("Instance index within repo", fontsize=11)
    ax.set_title("Resolution Heatmap — Per Instance\n" + _subtitle(rows),
                 fontsize=13, fontweight="bold")

    from matplotlib.patches import Patch
    legend_elements = [
        Patch(facecolor=VEXP_GREEN, label="Resolved"),
        Patch(facecolor="#e45756", label="Failed"),
        Patch(facecolor="#fbbf24", label="Unevaluated"),
    ]
    ax.legend(handles=legend_elements, loc="upper right", fontsize=9)

    _save(fig, output_dir, "04-resolution-heatmap.png", dpi)


# ── Compare mode charts ─────────────────────────────────────────────

def plot_compare_leaderboard(vexp_rows, baseline_rows, externals, subset_ids, output_dir, dpi):
    """Bar chart comparing pass rates across agents."""
    entries = []

    # vexp
    vexp_resolved = sum(1 for r in vexp_rows if r.get("resolved") is True and r["instanceId"] in subset_ids)
    total = len(subset_ids)
    entries.append(("vexp + Claude Code (Opus 4.5)", vexp_resolved / total * 100, VEXP_BLUE))

    # baseline
    if baseline_rows:
        bl_map = {r["instanceId"]: r for r in baseline_rows}
        bl_resolved = sum(1 for iid in subset_ids if bl_map.get(iid, {}).get("resolved") is True)
        entries.append(("baseline (no vexp)", bl_resolved / total * 100, BASELINE_COLOR))

    # externals
    for i, ext in enumerate(externals):
        ext_resolved = sum(1 for iid in ext["resolvedIds"] if iid in subset_ids)
        color = EXTERNAL_COLORS[i % len(EXTERNAL_COLORS)]
        entries.append((ext["system"], ext_resolved / total * 100, color))

    entries.sort(key=lambda e: e[1], reverse=True)

    fig, ax = plt.subplots(figsize=(10, max(4, len(entries) * 1.2)))
    y = np.arange(len(entries))
    systems, scores, colors = zip(*entries)

    bars = ax.barh(y, scores, color=colors, alpha=0.92, edgecolor="white", linewidth=0.5, height=0.6)

    for j, (score, system) in enumerate(zip(scores, systems)):
        is_ours = system.startswith("vexp")
        ax.text(score + 0.8, j, "%.1f%%" % score, va="center",
                fontsize=12, fontweight="bold",
                color=VEXP_BLUE if is_ours else VEXP_GRAY)

    ax.set_yticks(y)
    ax.set_yticklabels(systems, fontsize=11)
    ax.set_xlabel("Pass@1 (%)", fontsize=12)
    ax.set_xlim(0, max(scores) + 10)
    ax.set_title("SWE-bench Verified — Agent Comparison\n%d-task subset" % total,
                 fontsize=14, fontweight="bold")
    ax.invert_yaxis()
    _despine(ax)

    _save(fig, output_dir, "01-comparison-leaderboard.png", dpi)


def plot_compare_per_repo(vexp_rows, baseline_rows, externals, subset_ids, output_dir, dpi):
    """Grouped bar chart per repo."""
    repos_set = set()
    by_repo_vexp = defaultdict(lambda: {"total": 0, "resolved": 0})
    for r in vexp_rows:
        if r["instanceId"] in subset_ids:
            by_repo_vexp[r["repo"]]["total"] += 1
            if r.get("resolved") is True:
                by_repo_vexp[r["repo"]]["resolved"] += 1
            repos_set.add(r["repo"])

    repos = sorted(repos_set)
    repo_labels = [r.split("/")[-1] for r in repos]

    # Build agent data: list of (name, color, {repo: pct})
    agents = []
    vexp_pcts = {r: by_repo_vexp[r]["resolved"] / by_repo_vexp[r]["total"] * 100
                 if by_repo_vexp[r]["total"] > 0 else 0 for r in repos}
    agents.append(("vexp", VEXP_BLUE, vexp_pcts))

    if baseline_rows:
        by_repo_bl = defaultdict(lambda: {"total": 0, "resolved": 0})
        for r in baseline_rows:
            if r["instanceId"] in subset_ids:
                by_repo_bl[r["repo"]]["total"] += 1
                if r.get("resolved") is True:
                    by_repo_bl[r["repo"]]["resolved"] += 1
        bl_pcts = {r: by_repo_bl[r]["resolved"] / by_repo_bl[r]["total"] * 100
                   if by_repo_bl[r]["total"] > 0 else 0 for r in repos}
        agents.append(("baseline", BASELINE_COLOR, bl_pcts))

    # Map instance to repo
    inst_repo = {r["instanceId"]: r["repo"] for r in vexp_rows if r["instanceId"] in subset_ids}
    for i, ext in enumerate(externals):
        by_repo_ext = defaultdict(lambda: {"total": 0, "resolved": 0})
        for iid in subset_ids:
            repo = inst_repo.get(iid)
            if repo:
                by_repo_ext[repo]["total"] += 1
                if iid in set(ext["resolvedIds"]):
                    by_repo_ext[repo]["resolved"] += 1
        ext_pcts = {r: by_repo_ext[r]["resolved"] / by_repo_ext[r]["total"] * 100
                    if by_repo_ext[r]["total"] > 0 else 0 for r in repos}
        color = EXTERNAL_COLORS[i % len(EXTERNAL_COLORS)]
        agents.append((ext["system"][:20], color, ext_pcts))

    n_agents = len(agents)
    x = np.arange(len(repos))
    width = 0.8 / n_agents

    fig, ax = plt.subplots(figsize=(max(12, len(repos) * 1.5), FIG_HEIGHT))

    for i, (name, color, pcts) in enumerate(agents):
        vals = [pcts.get(r, 0) for r in repos]
        offset = (i - n_agents / 2 + 0.5) * width
        ax.bar(x + offset, vals, width, label=name, color=color, alpha=0.92, edgecolor="white")

    ax.set_xticks(x)
    ax.set_xticklabels(repo_labels, rotation=35, ha="right", fontsize=9)
    ax.set_ylim(0, 105)
    ax.set_ylabel("Pass@1 (%)", fontsize=12)
    ax.set_title("Per-Repository Comparison", fontsize=14, fontweight="bold")
    ax.legend(fontsize=10)
    _despine(ax)

    _save(fig, output_dir, "02-per-repo-comparison.png", dpi)


def plot_compare_delta_heatmap(vexp_rows, baseline_rows, externals, subset_ids, output_dir, dpi):
    """Heatmap showing who resolved what."""
    vexp_resolved = {r["instanceId"] for r in vexp_rows if r.get("resolved") is True}
    inst_repo = {r["instanceId"]: r["repo"] for r in vexp_rows if r["instanceId"] in subset_ids}

    # Build comparison with first external or baseline
    compare_name = ""
    compare_resolved = set()
    if externals:
        compare_name = externals[0]["system"][:25]
        compare_resolved = set(externals[0]["resolvedIds"]) & subset_ids
    elif baseline_rows:
        compare_name = "baseline"
        compare_resolved = {r["instanceId"] for r in baseline_rows
                           if r.get("resolved") is True and r["instanceId"] in subset_ids}

    if not compare_name:
        return

    by_repo = defaultdict(list)
    for iid in sorted(subset_ids):
        repo = inst_repo.get(iid, "unknown")
        v = iid in vexp_resolved
        c = iid in compare_resolved
        # 3 = both, 2 = only vexp, 1 = only other, 0 = neither
        if v and c:
            val = 3
        elif v and not c:
            val = 2
        elif not v and c:
            val = 1
        else:
            val = 0
        by_repo[repo].append(val)

    repos = sorted(by_repo.keys())
    y_labels = [r.split("/")[-1] for r in repos]

    matrix = [by_repo[r] for r in repos]
    max_len = max(len(r) for r in matrix)
    for row in matrix:
        row.extend([-1] * (max_len - len(row)))

    cmap = plt.cm.colors.ListedColormap(["#f3f4f6", "#e45756", VEXP_ORANGE, VEXP_BLUE, VEXP_GREEN])
    bounds = [-1.5, -0.5, 0.5, 1.5, 2.5, 3.5]
    norm = plt.cm.colors.BoundaryNorm(bounds, cmap.N)

    fig, ax = plt.subplots(figsize=(max(14, len(subset_ids) * 0.15), max(4, len(repos) * 1.2)))
    ax.imshow(matrix, cmap=cmap, norm=norm, aspect="auto", interpolation="nearest")
    ax.set_yticks(range(len(y_labels)))
    ax.set_yticklabels(y_labels, fontsize=10)
    ax.set_xlabel("Instance index within repo", fontsize=11)
    ax.set_title("Resolution Comparison: vexp vs %s" % compare_name,
                 fontsize=13, fontweight="bold")

    from matplotlib.patches import Patch
    legend_elements = [
        Patch(facecolor=VEXP_GREEN, label="Both resolved"),
        Patch(facecolor=VEXP_BLUE, label="Only vexp"),
        Patch(facecolor=VEXP_ORANGE, label="Only %s" % compare_name),
        Patch(facecolor="#e45756", label="Neither"),
    ]
    ax.legend(handles=legend_elements, loc="upper right", fontsize=9)

    _save(fig, output_dir, "03-resolution-delta.png", dpi)


def plot_compare_cost(vexp_rows, baseline_rows, subset_ids, output_dir, dpi):
    """Cost comparison between vexp and baseline."""
    if not baseline_rows:
        return

    vexp_map = {r["instanceId"]: r for r in vexp_rows if r["instanceId"] in subset_ids}
    bl_map = {r["instanceId"]: r for r in baseline_rows if r["instanceId"] in subset_ids}

    common = sorted(set(vexp_map.keys()) & set(bl_map.keys()))
    if not common:
        return

    vexp_costs = [vexp_map[iid]["costUsd"] for iid in common]
    bl_costs = [bl_map[iid]["costUsd"] for iid in common]

    fig, ax = plt.subplots(figsize=(10, FIG_HEIGHT))

    x = np.arange(len(common))
    width = 0.35
    ax.bar(x - width / 2, vexp_costs, width, label="vexp", color=VEXP_BLUE, alpha=0.85)
    ax.bar(x + width / 2, bl_costs, width, label="baseline", color=BASELINE_COLOR, alpha=0.85)

    ax.set_ylabel("Cost ($)", fontsize=12)
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: "$%.2f" % v))
    ax.set_title("Cost Comparison: vexp vs baseline\nAvg vexp: $%.2f | Avg baseline: $%.2f" %
                 (np.mean(vexp_costs), np.mean(bl_costs)),
                 fontsize=13, fontweight="bold")
    ax.legend(fontsize=11)
    _despine(ax)

    _save(fig, output_dir, "04-cost-comparison.png", dpi)


# ── Main ─────────────────────────────────────────────────────────────

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Generate vexp-swe-bench charts")
    parser.add_argument("jsonl", help="Path to vexp results JSONL")
    parser.add_argument("-o", "--output", default="plots")
    parser.add_argument("--dpi", type=int, default=150)
    parser.add_argument("--baseline", help="Path to baseline results JSONL")
    parser.add_argument("--external", action="append", default=[], help="External agent names")
    args = parser.parse_args()

    sns.set_theme(style="whitegrid", font_scale=1.1)
    os.makedirs(args.output, exist_ok=True)

    rows = load_results(args.jsonl)
    subset_ids = set(r["instanceId"] for r in rows)
    print("Loaded %d results, %d instances\n" % (len(rows), len(subset_ids)))

    data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")

    baseline_rows = load_results(args.baseline) if args.baseline else None
    externals = []
    for name in args.external:
        ext = load_external_agent(name, data_dir)
        if ext:
            externals.append(ext)
        else:
            print("  Warning: external agent '%s' not found" % name)

    has_compare = baseline_rows is not None or len(externals) > 0

    if has_compare:
        # Compare mode
        plot_compare_leaderboard(rows, baseline_rows, externals, subset_ids, args.output, args.dpi)
        plot_compare_per_repo(rows, baseline_rows, externals, subset_ids, args.output, args.dpi)
        plot_compare_delta_heatmap(rows, baseline_rows, externals, subset_ids, args.output, args.dpi)
        if baseline_rows:
            plot_compare_cost(rows, baseline_rows, subset_ids, args.output, args.dpi)
    else:
        # Single mode (no leaderboard)
        plot_pass_rate(rows, args.output, args.dpi)
        plot_cost(rows, args.output, args.dpi)
        plot_dashboard(rows, args.output, args.dpi)
        plot_resolution_heatmap(rows, args.output, args.dpi)

    resolved = sum(1 for r in rows if r.get("resolved") is True)
    total = len(rows)
    print("\n  Pass@1: %d/%d (%.1f%%)" % (resolved, total, resolved / total * 100 if total else 0))
    print("  All charts saved to: %s/" % args.output)


if __name__ == "__main__":
    main()
