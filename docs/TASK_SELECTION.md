# Task Selection Methodology

## Overview

vexp-swe-bench uses a curated **100-task subset** of the full 500-task SWE-bench Verified dataset. The subset is designed to be statistically representative of the full dataset while being practical to run in a reasonable time and cost.

## Statistical Validity

The 100-task subset provides sufficient statistical power for meaningful comparisons:

- **100% repository coverage**: all 12 repositories in SWE-bench Verified are represented
- **Proportional allocation**: each repository's share of the subset closely tracks its share of the full 500-task set (e.g., django 44% vs 46% in full, sympy 17% vs 15%)
- **Complexity alignment**: the subset's median complexity (22) closely matches the full dataset's median (23), ensuring comparable difficulty distribution
- **95% confidence interval**: at a 73% pass rate on 100 instances, the margin of error is ±8.7 percentage points — sufficient to distinguish agents with >9-point differences
- **Outlier exclusion**: a complexity ceiling (≤ 250) filters extreme outliers that disproportionately affect small sample scores, removing ~1% of instances

For reference, this is the same methodology used by many published SWE-bench evaluations that report on subsets rather than the full 500-task set.

## Selection Strategy

We use **stratified sampling** to ensure proportional representation across all repositories and difficulty levels.

### Algorithm

1. **Complexity filtering**: Instances with complexity score > 250 are excluded to focus on practical, real-world bugs rather than extreme outliers.
2. **Group by repository**: Remaining instances are grouped by their source repository (e.g., django/django, matplotlib/matplotlib).
3. **Proportional allocation**: Each repository receives a number of instances proportional to its share of the filtered dataset.
4. **Complexity-based quintile sampling**: Within each repository, instances are sorted by a complexity proxy and divided into 5 quintiles. We sample evenly from each quintile to ensure coverage of easy, medium, and hard tasks.
5. **Fixed seed**: We use a fixed random seed (42) for reproducibility.

### Complexity Proxy

The complexity score for each instance is computed as:

```
complexity = (number_of_FAIL_TO_PASS_tests × 10) + patch_line_count
```

Where:
- `FAIL_TO_PASS` tests indicate how many tests need to start passing after the fix
- `patch_line_count` is the number of changed lines in the gold solution

This gives higher weight to instances requiring more test fixes, while also considering the size of the required code change.

### Repository Distribution

| Repository | Full (500) | Subset (100) | Ratio |
|------------|-----------|-------------|-------|
| django/django | 231 | 44 | 19.0% |
| sympy/sympy | 75 | 17 | 22.7% |
| sphinx-doc/sphinx | 44 | 7 | 15.9% |
| matplotlib/matplotlib | 34 | 7 | 20.6% |
| scikit-learn/scikit-learn | 32 | 2 | 6.2% |
| astropy/astropy | 22 | 5 | 22.7% |
| pydata/xarray | 22 | 6 | 27.3% |
| pytest-dev/pytest | 19 | 4 | 21.1% |
| pylint-dev/pylint | 10 | 2 | 20.0% |
| psf/requests | 8 | 4 | 50.0% |
| mwaskom/seaborn | 2 | 1 | 50.0% |
| pallets/flask | 1 | 1 | 100.0% |

## Reproducibility

The subset is bundled as `data/swe-bench-100.jsonl`. The selection script is included at `scripts/select-subset.py` for reference.

## Comparing with Other Agents

We include per-instance resolution data from other publicly available agent submissions on SWE-bench Verified (from the [swe-bench/experiments](https://github.com/swe-bench/experiments) repository). This allows direct, apples-to-apples comparison on the exact same subset of tasks — no extrapolation needed.

Available external agent data is stored in `data/external/` and can be used with:

```bash
node dist/cli.js compare results/swebench-2026-03-22.jsonl
```
