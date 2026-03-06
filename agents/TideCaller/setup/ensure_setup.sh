#!/usr/bin/env bash
#
# ensure_setup.sh — Guard de auto-setup do TideCaller
#
# Source este arquivo no início de qualquer script que precise do venv:
#
#   source "$(dirname "${BASH_SOURCE[0]}")/../setup/ensure_setup.sh"
#
# Se o venv não estiver pronto, o setup completo é executado automaticamente.
# O usuário não precisa fazer nada manualmente.
#

_ENSURE_AGENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
_ENSURE_VENV="$_ENSURE_AGENT_DIR/.venv_tidal"
_ENSURE_SETUP="$_ENSURE_AGENT_DIR/setup/setup.sh"

_tidecaller_is_ready() {
  [[ -x "$_ENSURE_VENV/bin/python3" ]] \
    && "$_ENSURE_VENV/bin/python3" -c "import streamrip" 2>/dev/null \
    && "$_ENSURE_VENV/bin/python3" -c "import tidalapi"  2>/dev/null
}

if ! _tidecaller_is_ready; then
  echo ""
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║  🌊  TideCaller — Primeiro uso detectado                ║"
  echo "║      Executando setup automático...                     ║"
  echo "╚══════════════════════════════════════════════════════════╝"
  echo ""

  if [[ ! -f "$_ENSURE_SETUP" ]]; then
    echo "❌  setup.sh não encontrado em: $_ENSURE_SETUP"
    exit 1
  fi

  bash "$_ENSURE_SETUP" --no-auth

  # Verificar novamente após setup
  if ! _tidecaller_is_ready; then
    echo ""
    echo "❌  Setup falhou. Execute manualmente:"
    echo "    bash $_ENSURE_SETUP"
    exit 1
  fi

  echo ""
  echo "✅  Setup concluído — continuando..."
  echo ""
fi

# Exportar o caminho do venv para os scripts que o sourcearam
TIDECALLER_VENV="$_ENSURE_VENV"
TIDECALLER_AGENT_DIR="$_ENSURE_AGENT_DIR"
export TIDECALLER_VENV TIDECALLER_AGENT_DIR
