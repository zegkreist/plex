#!/bin/bash
#
# refresh_token.sh — Renova tokens Tidal via tidalapi (OAuth device flow)
#
# Uso:
#   bash scripts/refresh_token.sh           → refresh automático; OAuth se necessário
#   bash scripts/refresh_token.sh --force   → força novo login OAuth
#   bash scripts/refresh_token.sh --check   → só verifica se o token está válido
#   node plex-cli.js tidecaller:refresh-token
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Auto-setup: instala venv + deps se necessário
source "$PROJECT_ROOT/setup/ensure_setup.sh"

PYTHON="$TIDECALLER_VENV/bin/python3"
TOKEN_SCRIPT="$PROJECT_ROOT/setup/get_tidal_tokens.py"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}    🌊 TideCaller — Renovação de Token Tidal${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
echo ""

# ── Executar script de tokens ─────────────────────────────────────────────────
"$PYTHON" "$TOKEN_SCRIPT" "$@"
