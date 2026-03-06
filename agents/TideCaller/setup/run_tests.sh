#!/usr/bin/env bash
#
# run_tests.sh — Roda todos os testes do TideCaller
# Chamado por: node plex-cli.js tidecaller:test
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$(dirname "$SCRIPT_DIR")"
VENV="$AGENT_DIR/.venv_tidal"

CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
step() { echo -e "\n${BOLD}${CYAN}══ $* ${NC}"; }

FAILED=0

# ─── BATS: testes de setup ───────────────────────────────────────────────────
step "BATS — setup (37 testes)"
if command -v bats &>/dev/null; then
  bats "$SCRIPT_DIR/test_setup.bats" || FAILED=$((FAILED + 1))
else
  echo "⚠️  bats não instalado — pulando testes BATS"
fi

# ─── BATS: testes de integração via plex-cli ─────────────────────────────────
step "BATS — integração via plex-cli"
if command -v bats &>/dev/null; then
  bats "$SCRIPT_DIR/test_integration.bats" || FAILED=$((FAILED + 1))
else
  echo "⚠️  bats não instalado — pulando testes de integração"
fi

# ─── pytest: testes unitários Python ─────────────────────────────────────────
step "pytest — download_artist.py"
if [[ -x "$VENV/bin/python3" ]]; then
  "$VENV/bin/python3" -m pytest "$AGENT_DIR/scripts/tests/" -v || FAILED=$((FAILED + 1))
else
  echo "⚠️  venv não encontrado — rode: node plex-cli.js tidecaller:setup"
  FAILED=$((FAILED + 1))
fi

# ─── Resultado ───────────────────────────────────────────────────────────────
echo ""
if [[ "$FAILED" -eq 0 ]]; then
  echo -e "${BOLD}\033[32m✅  Todos os testes passaram!${NC}"
  exit 0
else
  echo -e "${BOLD}\033[31m❌  $FAILED suite(s) com falha.${NC}"
  exit 1
fi
