#!/usr/bin/env bash
set -euo pipefail

# ── vexp-swe-bench setup ────────────────────────────────────────────
#
# Installs all prerequisites and prepares the benchmark for launch.
# Run once:  ./setup.sh
# Then:      node dist/cli.js run
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

VENV_DIR=".venv"
MIN_NODE=18
MIN_PYTHON=3
DATA_FILE="data/swe-bench-100.jsonl"
FULL_DATASET="swebench-verified-full.jsonl"

# ── Colors ───────────────────────────────────────────────────────────

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; exit 1; }
step() { echo -e "\n${BLUE}${BOLD}══ $1 ══${NC}"; }

echo -e "${BLUE}"
cat << 'BANNER'
  ██╗   ██╗███████╗██╗  ██╗██████╗
  ██║   ██║██╔════╝╚██╗██╔╝██╔══██╗
  ██║   ██║█████╗   ╚███╔╝ ██████╔╝
  ╚██╗ ██╔╝██╔══╝   ██╔██╗ ██╔═══╝
   ╚████╔╝ ███████╗██╔╝ ██╗██║
    ╚═══╝  ╚══════╝╚═╝  ╚═╝╚═╝
BANNER
echo -e "${NC}  SWE-bench Verified Harness — Setup\n"

# ── 1. Check Node.js ────────────────────────────────────────────────

step "Node.js"

if ! command -v node &>/dev/null; then
  fail "Node.js not found. Install Node.js >= ${MIN_NODE}: https://nodejs.org"
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt "$MIN_NODE" ]; then
  fail "Node.js v${NODE_VERSION} is too old (need >= ${MIN_NODE}). Update: https://nodejs.org"
fi
ok "Node.js $(node -v)"

# ── 2. Check Python 3 ──────────────────────────────────────────────

step "Python"

MIN_PY_MINOR=10

PYTHON=""
for cmd in python3.12 python3.11 python3.10 python3 python; do
  if command -v "$cmd" &>/dev/null; then
    PY_VER=$("$cmd" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>/dev/null || echo "0.0")
    PY_MAJOR=$(echo "$PY_VER" | cut -d. -f1)
    PY_MINOR=$(echo "$PY_VER" | cut -d. -f2)
    if [ "$PY_MAJOR" -ge "$MIN_PYTHON" ] && [ "$PY_MINOR" -ge "$MIN_PY_MINOR" ]; then
      PYTHON="$cmd"
      break
    fi
  fi
done

if [ -z "$PYTHON" ]; then
  fail "Python >= 3.10 required (swebench dependency). Found: $(python3 --version 2>&1 || echo 'none')"
  echo -e "  Install Python 3.10+: https://www.python.org/downloads/"
fi
ok "$PYTHON $($PYTHON --version 2>&1 | awk '{print $2}')"

# ── 3. Check Git ───────────────────────────────────────────────────

step "Git"

if ! command -v git &>/dev/null; then
  fail "Git not found. Install git: https://git-scm.com"
fi
ok "git $(git --version | awk '{print $3}')"

# ── 4. Check Docker (optional) ─────────────────────────────────────

step "Docker (optional — needed for accurate evaluation)"

if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
  ok "Docker $(docker --version | awk '{print $3}' | tr -d ',')"
else
  warn "Docker not available. You can still run benchmarks, but evaluation will be lightweight only."
fi

# ── 5. Check Claude CLI (optional) ─────────────────────────────────

step "Claude Code CLI"

if command -v claude &>/dev/null; then
  ok "claude CLI found"
else
  warn "claude CLI not found. Install: https://docs.anthropic.com/en/docs/claude-code"
  warn "Required to run the default agent adapter."
fi

# ── 6. Python venv + dependencies ──────────────────────────────────

step "Python virtual environment"

if [ ! -d "$VENV_DIR" ]; then
  echo "  Creating venv..."
  $PYTHON -m venv "$VENV_DIR"
  ok "venv created at ${VENV_DIR}/"
else
  ok "venv already exists"
fi

source "${VENV_DIR}/bin/activate"

echo "  Installing Python dependencies..."
pip install --quiet --upgrade pip
pip install --quiet -r scripts/requirements.txt
pip install --quiet datasets
ok "Python dependencies installed"

# ── 7. Node dependencies + build ───────────────────────────────────

step "Node.js dependencies"

echo "  Installing npm packages..."
npm install --silent 2>/dev/null
ok "npm packages installed"

echo "  Building TypeScript..."
npx tsc 2>/dev/null
ok "TypeScript compiled"

# ── 8. Download SWE-bench dataset + generate subset ────────────────

step "SWE-bench Verified dataset"

PLACEHOLDER_CHECK=$(head -1 "$DATA_FILE" 2>/dev/null | grep -c '"placeholder"' || true)

if [ "$PLACEHOLDER_CHECK" -gt 0 ] || [ ! -s "$DATA_FILE" ]; then
  if [ ! -f "$FULL_DATASET" ]; then
    echo "  Downloading SWE-bench Verified from HuggingFace..."
    $PYTHON -c "
from datasets import load_dataset
ds = load_dataset('princeton-nlp/SWE-bench_Verified', split='test')
ds.to_json('${FULL_DATASET}')
print('  Downloaded %d instances' % len(ds))
"
    ok "Dataset downloaded"
  else
    ok "Full dataset already present"
  fi

  echo "  Selecting 100-task representative subset..."
  $PYTHON scripts/select-subset.py \
    --input "$FULL_DATASET" \
    --output "$DATA_FILE"
  ok "Subset generated"

  echo "  Rebuilding with new data..."
  npx tsc 2>/dev/null
  ok "Rebuild complete"
else
  INSTANCE_COUNT=$(wc -l < "$DATA_FILE" | tr -d ' ')
  ok "Dataset ready (${INSTANCE_COUNT} instances)"
fi

# ── 9. Verify ──────────────────────────────────────────────────────

step "Verification"

node dist/cli.js list 2>/dev/null | tail -2
ok "CLI working"

# ── Done ───────────────────────────────────────────────────────────

echo -e "\n${GREEN}${BOLD}  Setup complete!${NC}\n"
echo -e "  To run the benchmark:"
echo -e "    ${BOLD}source .venv/bin/activate${NC}"
echo -e "    ${BOLD}node dist/cli.js run${NC}"
echo -e ""
echo -e "  Quick test (single instance):"
echo -e "    ${BOLD}node dist/cli.js run --instances django__django-11099${NC}"
echo -e ""
echo -e "  Dry run (preview only):"
echo -e "    ${BOLD}node dist/cli.js run --dry-run${NC}"
echo -e ""
