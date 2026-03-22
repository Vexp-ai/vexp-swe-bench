#!/usr/bin/env python3
"""
Select a representative 100-task subset from SWE-bench Verified.

Strategy: complexity filtering (≤ 250) to exclude extreme outliers,
then stratified sampling across repositories with proportional allocation
and even coverage across complexity quintiles within each repo.

Usage:
    python scripts/select-subset.py --input swebench-verified-full.jsonl --output data/swe-bench-100.jsonl

To download the full dataset:
    pip install datasets
    python -c "
    from datasets import load_dataset
    ds = load_dataset('princeton-nlp/SWE-bench_Verified', split='test')
    ds.to_json('swebench-verified-full.jsonl')
    "
"""

import argparse
import json
import random
from collections import defaultdict


SEED = 42
TARGET_SIZE = 100


def complexity_score(instance):
    """Compute a complexity proxy for an instance."""
    # Number of tests that need to start passing
    try:
        fail_to_pass = json.loads(instance.get("FAIL_TO_PASS", "[]"))
    except (json.JSONDecodeError, TypeError):
        fail_to_pass = []

    # Size of the gold patch (lines changed)
    patch = instance.get("patch", "")
    patch_lines = len([l for l in patch.split("\n")
                       if l.startswith("+") or l.startswith("-")])

    return len(fail_to_pass) * 10 + patch_lines


def select_subset(instances, target=TARGET_SIZE):
    """Select a representative subset using stratified sampling."""
    rng = random.Random(SEED)

    # Group by repo
    by_repo = defaultdict(list)
    for inst in instances:
        by_repo[inst["repo"]].append(inst)

    total = len(instances)
    selected = []

    for repo, repo_instances in sorted(by_repo.items()):
        # Proportional allocation
        repo_count = max(1, round(len(repo_instances) / total * target))

        # Sort by complexity
        repo_instances.sort(key=complexity_score)

        # Sample evenly across quintiles
        n = len(repo_instances)
        if repo_count >= n:
            selected.extend(repo_instances)
            continue

        # Divide into quintiles and sample from each
        quintile_size = n / 5
        per_quintile = max(1, repo_count // 5)
        remainder = repo_count - per_quintile * 5

        for q in range(5):
            start = int(q * quintile_size)
            end = int((q + 1) * quintile_size)
            pool = repo_instances[start:end]

            take = per_quintile + (1 if q < remainder else 0)
            take = min(take, len(pool))

            selected.extend(rng.sample(pool, take))

    # Trim or pad to exact target
    if len(selected) > target:
        rng.shuffle(selected)
        selected = selected[:target]

    # Sort for stable output
    selected.sort(key=lambda x: x["instance_id"])

    return selected


def main():
    parser = argparse.ArgumentParser(description="Select 100-task SWE-bench subset")
    parser.add_argument("--input", required=True, help="Full SWE-bench Verified JSONL")
    parser.add_argument("--output", default="data/swe-bench-100.jsonl", help="Output JSONL")
    args = parser.parse_args()

    # Load
    instances = []
    with open(args.input) as f:
        for line in f:
            if line.strip():
                instances.append(json.loads(line))

    print("Loaded %d instances from %s" % (len(instances), args.input))

    # Select
    subset = select_subset(instances)

    # Report
    by_repo = defaultdict(int)
    for inst in subset:
        by_repo[inst["repo"]] += 1

    print("\nSelected %d instances:" % len(subset))
    for repo in sorted(by_repo.keys()):
        orig = sum(1 for i in instances if i["repo"] == repo)
        print("  %-35s %3d / %3d" % (repo, by_repo[repo], orig))

    # Write
    with open(args.output, "w") as f:
        for inst in subset:
            f.write(json.dumps(inst) + "\n")

    print("\nWritten to %s" % args.output)


if __name__ == "__main__":
    main()
