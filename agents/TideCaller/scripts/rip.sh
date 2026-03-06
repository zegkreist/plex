#!/usr/bin/env bash
# Script auxiliar para executar streamrip via virtualenv Python
# Uso: ./rip.sh [argumentos do rip]
# Exemplo: ./rip.sh url https://tidal.com/browse/album/...
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$(dirname "$SCRIPT_DIR")"

# Auto-setup: instala venv + deps se necessário
source "$AGENT_DIR/setup/ensure_setup.sh"

# Token guard: retry automático em caso de falha de autenticação
source "$AGENT_DIR/setup/token_guard.sh"

RIP="$TIDECALLER_VENV/bin/rip"
export XDG_CONFIG_HOME="$TIDECALLER_AGENT_DIR/config/.config"
token_guard "$RIP" "$@"
