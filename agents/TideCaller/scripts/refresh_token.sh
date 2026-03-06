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
VENV="$PROJECT_ROOT/.venv_tidal"
PYTHON="$VENV/bin/python3"
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

# ── Garantir que tidalapi está instalado ─────────────────────────────────────
if [ ! -x "$PYTHON" ]; then
    echo -e "${YELLOW}Criando virtualenv em .venv_tidal...${NC}"
    python3 -m venv "$VENV"
fi

if ! "$PYTHON" -c "import tidalapi" 2>/dev/null; then
    echo -e "${YELLOW}Instalando tidalapi...${NC}"
    "$PYTHON" -m pip install --quiet tidalapi
fi

# ── Executar script de tokens ─────────────────────────────────────────────────
"$PYTHON" "$TOKEN_SCRIPT" "$@"
