#!/usr/bin/env bash
# TideCaller — busca e download interativo de artistas/álbuns do Tidal
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$(dirname "$SCRIPT_DIR")"
VENV="$AGENT_DIR/.venv_tidal"
PYTHON="$VENV/bin/python3"
DOWNLOAD_SCRIPT="$SCRIPT_DIR/download_artist.py"

# Garante venv existe
if [[ ! -x "$PYTHON" ]]; then
    echo "❌ Venv não encontrada em $VENV"
    echo "   Execute: bash $AGENT_DIR/scripts/setup_venv.sh"
    exit 1
fi

# Garante tidalapi instalado
if ! "$PYTHON" -c "import tidalapi" 2>/dev/null; then
    echo "📦 Instalando tidalapi..."
    "$PYTHON" -m pip install --quiet tidalapi
fi

exec "$PYTHON" "$DOWNLOAD_SCRIPT" "$@"
