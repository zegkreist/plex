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

# Se tidalapi está instalado no Python de sistema (ex: container Docker),
# exporta TIDECALLER_VENV para que outros scripts usem o python3 de sistema.
_tidecaller_system_ready() {
  python3 -c "import tidalapi; import streamrip" 2>/dev/null
}

_tidecaller_venv_ready() {
  [[ -x "$_ENSURE_VENV/bin/python3" ]] \
    && "$_ENSURE_VENV/bin/python3" -c "import streamrip" 2>/dev/null \
    && "$_ENSURE_VENV/bin/python3" -c "import tidalapi"  2>/dev/null
}

if _tidecaller_system_ready; then
  # Python de sistema já tem as dependências (modo container)
  export TIDECALLER_VENV=""
elif _tidecaller_venv_ready; then
  # Venv local pronta
  export TIDECALLER_VENV="$_ENSURE_VENV"
else
  # Venv não pronta — executar setup automático
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
  if ! _tidecaller_venv_ready; then
    echo ""
    echo "❌  Setup falhou. Execute manualmente:"
    echo "    bash $_ENSURE_SETUP"
    exit 1
  fi

  export TIDECALLER_VENV="$_ENSURE_VENV"
  echo ""
  echo "✅  Setup concluído — continuando..."
  echo ""
fi

export TIDECALLER_AGENT_DIR="$_ENSURE_AGENT_DIR"
