#!/usr/bin/env bash
# TideCaller — busca e download interativo de artistas/álbuns do Tidal
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$(dirname "$SCRIPT_DIR")"

# Auto-setup: instala venv + deps se necessário
source "$AGENT_DIR/setup/ensure_setup.sh"

PYTHON="$TIDECALLER_VENV/bin/python3"
DOWNLOAD_SCRIPT="$SCRIPT_DIR/download_artist.py"

exec "$PYTHON" "$DOWNLOAD_SCRIPT" "$@"
