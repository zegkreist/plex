#!/usr/bin/env bash
#
# TideCaller — Setup completo
#
# Uso:
#   bash setup/setup.sh            → instalação + autenticação Tidal interativa
#   bash setup/setup.sh --no-auth  → instalação apenas (sem OAuth, útil em testes)
#   bash setup/setup.sh --help     → esta mensagem
#
set -euo pipefail

# ── Caminhos ─────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
VENV="$AGENT_DIR/.venv_tidal"
CONFIG_DIR="$AGENT_DIR/config/.config/streamrip"
CONFIG_TOML="$CONFIG_DIR/config.toml"
TEMPLATE="$SCRIPT_DIR/config.toml.template"

# ── Cores ─────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "${GREEN}  ✅ $*${NC}"; }
warn() { echo -e "${YELLOW}  ⚠️  $*${NC}"; }
info() { echo -e "${CYAN}  ▶  $*${NC}"; }
err()  { echo -e "${RED}  ❌ $*${NC}" >&2; }
step() { echo -e "\n${BOLD}${CYAN}══ $* ${NC}"; }

# ── Flags ─────────────────────────────────────────────────────────────────────
NO_AUTH=false
for arg in "$@"; do
  case "$arg" in
    --no-auth) NO_AUTH=true ;;
    --help|-h)
      echo "Uso: bash setup/setup.sh [--no-auth] [--help]"
      echo ""
      echo "  --no-auth   Pula a etapa de autenticação Tidal (OAuth)"
      echo "  --help      Exibe esta mensagem"
      exit 0
      ;;
  esac
done

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║   🌊  TideCaller — Setup                    ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
step "1/5  Verificando pré-requisitos"

# Python 3
if ! command -v python3 &>/dev/null; then
  err "Python 3 não encontrado."
  echo "       Instale com: sudo apt install python3 python3-venv"
  exit 1
fi
PYTHON3="$(command -v python3)"
ok "Python 3: $(python3 --version)"

# ffmpeg (opcional — aviso apenas)
if ! command -v ffmpeg &>/dev/null; then
  warn "ffmpeg não encontrado — conversão de áudio desabilitada."
  warn "Instale com: sudo apt install ffmpeg"
else
  ok "ffmpeg: $(ffmpeg -version 2>&1 | head -1 | sed 's/ffmpeg version //')"
fi

# ─────────────────────────────────────────────────────────────────────────────
step "2/5  Configurando virtualenv Python"

if [[ ! -d "$VENV" ]]; then
  info "Criando virtualenv em .venv_tidal ..."
  "$PYTHON3" -m venv "$VENV"
  ok "Virtualenv criado"
else
  ok "Virtualenv já existe em .venv_tidal"
fi

# Bootstrap pip caso esteja ausente (containers minimalistas)
if ! "$VENV/bin/python3" -m pip --version &>/dev/null; then
  info "Inicializando pip (ensurepip) ..."
  "$VENV/bin/python3" -m ensurepip --upgrade
fi
ok "pip: $("$VENV/bin/python3" -m pip --version | awk '{print $2}')"

# ─────────────────────────────────────────────────────────────────────────────
step "3/5  Instalando dependências Python"

info "Atualizando pip ..."
"$VENV/bin/python3" -m pip install --quiet --upgrade pip

PACKAGES_NEEDED=()
"$VENV/bin/python3" -c "import streamrip" 2>/dev/null || PACKAGES_NEEDED+=("streamrip")
"$VENV/bin/python3" -c "import tidalapi" 2>/dev/null  || PACKAGES_NEEDED+=("tidalapi")

if [[ ${#PACKAGES_NEEDED[@]} -gt 0 ]]; then
  info "Instalando: ${PACKAGES_NEEDED[*]} ..."
  "$VENV/bin/python3" -m pip install --quiet "${PACKAGES_NEEDED[@]}"
  ok "Pacotes instalados"
else
  ok "streamrip e tidalapi já estão instalados"
fi

# Verificação final
"$VENV/bin/python3" -c "import streamrip" \
  || { err "streamrip não instalou corretamente."; exit 1; }
"$VENV/bin/python3" -c "import tidalapi" \
  || { err "tidalapi não instalou corretamente."; exit 1; }
ok "streamrip: $("$VENV/bin/python3" -c "import streamrip; print(streamrip.__version__)" 2>/dev/null || echo 'ok')"
ok "tidalapi:  $("$VENV/bin/python3" -c "import tidalapi; print(tidalapi.__version__)" 2>/dev/null || echo 'ok')"

# ─────────────────────────────────────────────────────────────────────────────
step "4/5  Configurando streamrip"

mkdir -p "$CONFIG_DIR"

if [[ ! -f "$CONFIG_TOML" ]]; then
  if [[ ! -f "$TEMPLATE" ]]; then
    err "Template não encontrado: $TEMPLATE"
    exit 1
  fi
  info "Gerando config.toml a partir do template ..."
  sed "s|__AGENT_DIR__|${AGENT_DIR}|g" "$TEMPLATE" > "$CONFIG_TOML"
  ok "config.toml criado em config/.config/streamrip/"
else
  # Corrigir caminhos Docker (/downloads, /config) se ainda presentes
  NEEDS_FIX=false
  grep -qP '^folder\s*=\s*"/downloads"' "$CONFIG_TOML" 2>/dev/null && NEEDS_FIX=true
  grep -q 'downloads_path.*"/config/' "$CONFIG_TOML" 2>/dev/null && NEEDS_FIX=true

  if [[ "$NEEDS_FIX" == "true" ]]; then
    info "config.toml existente tem caminhos Docker — corrigindo ..."
    cp "$CONFIG_TOML" "${CONFIG_TOML}.bak"
    sed -i \
      -e "s|^folder\s*=\s*\"/downloads\"|folder = \"${AGENT_DIR}/downloads\"|" \
      -e "s|downloads_path = \"/config/|downloads_path = \"${AGENT_DIR}/config/|g" \
      -e "s|failed_downloads_path = \"/config/|failed_downloads_path = \"${AGENT_DIR}/config/|g" \
      -e "s|video_downloads_folder = \"/config/|video_downloads_folder = \"${AGENT_DIR}/config/|g" \
      "$CONFIG_TOML"
    ok "Caminhos corrigidos (backup em config.toml.bak)"
  else
    ok "config.toml já existe e está correto"
  fi
fi

# Garantir diretório de downloads
mkdir -p "$AGENT_DIR/downloads"
ok "Pasta downloads/ pronta"

# ─────────────────────────────────────────────────────────────────────────────
step "5/5  Ajustando permissões dos scripts"

chmod +x \
  "$AGENT_DIR/scripts/rip.sh" \
  "$AGENT_DIR/scripts/download_artist.sh" \
  "$AGENT_DIR/scripts/download_artists.sh" \
  "$AGENT_DIR/scripts/refresh_token.sh" \
  "$AGENT_DIR/scripts/enrich_metadata.sh" \
  "$AGENT_DIR/scripts/organize_albums.sh" \
  "$AGENT_DIR/scripts/tidal.sh" \
  "$AGENT_DIR/setup/setup.sh" \
  "$AGENT_DIR/setup/ensure_setup.sh" \
  "$AGENT_DIR/setup/token_guard.sh" \
  "$AGENT_DIR/setup/setup_tidal.sh" \
  "$AGENT_DIR/setup/install_streamrip.sh"

ok "Scripts executáveis"

# ─────────────────────────────────────────────────────────────────────────────
# Autenticação Tidal
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}══ Autenticação Tidal ${NC}"

if [[ "$NO_AUTH" == "true" ]]; then
  warn "Pulando autenticação Tidal (--no-auth)"
else
  # Verificar se já há tokens válidos no config.toml
  CURRENT_TOKEN="$(grep -E '^access_token\s*=' "$CONFIG_TOML" | sed 's/.*=\s*"\(.*\)"/\1/' | tr -d ' ')"

  if [[ -n "$CURRENT_TOKEN" && "$CURRENT_TOKEN" != '""' && "$CURRENT_TOKEN" != "" ]]; then
    ok "Tokens Tidal já configurados no config.toml"
    echo ""
    echo -e "  Para renovar: ${CYAN}bash $AGENT_DIR/scripts/refresh_token.sh${NC}"
  else
    echo ""
    echo "  Nenhum token Tidal encontrado."
    echo -e "  É necessário fazer login no Tidal (OAuth via browser/QR code)."
    echo ""
    read -r -p "  Autenticar agora? (s/N) " REPLY
    echo ""
    if [[ "$REPLY" =~ ^[SsYy]$ ]]; then
      "$VENV/bin/python3" "$SCRIPT_DIR/get_tidal_tokens.py"
    else
      warn "Autenticação pulada."
      echo ""
      echo -e "  Quando quiser autenticar: ${CYAN}bash $AGENT_DIR/setup/setup.sh${NC}"
      echo -e "  Ou só o token:            ${CYAN}bash $AGENT_DIR/scripts/refresh_token.sh${NC}"
    fi
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║   ✅  Setup concluído!                       ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Próximos passos:${NC}"
echo ""
echo -e "  1. Autenticar no Tidal (se ainda não fez):"
echo -e "     ${CYAN}bash $AGENT_DIR/scripts/refresh_token.sh${NC}"
echo ""
echo -e "  2. Baixar por URL:"
echo -e "     ${CYAN}bash $AGENT_DIR/scripts/rip.sh url <URL_DO_TIDAL>${NC}"
echo ""
echo -e "  3. Buscar e baixar artista interativamente:"
echo -e "     ${CYAN}bash $AGENT_DIR/scripts/download_artist.sh${NC}"
echo ""
echo -e "  4. Menu completo:"
echo -e "     ${CYAN}bash $AGENT_DIR/scripts/tidal.sh menu${NC}"
echo ""
