#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Build e push da imagem MusicSage para o DockerHub.
#
# Uso:
#   cd plex_server/
#   ./musicsage/build-and-push.sh
#
# Opções:
#   --user <dockerhub-user>   Usuário DockerHub (ou define DOCKERHUB_USER no env)
#   --tag  <tag>              Tag da imagem (default: latest)
#   --no-cache                Build sem cache
#   --push-only               Só faz push (não builda novamente)
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Configurações padrão ──────────────────────────────────────────────────────
DOCKERHUB_USER="${DOCKERHUB_USER:-}"
IMAGE_NAME="musicsage"
TAG="latest"
NO_CACHE=""
PUSH_ONLY=false

# ── Parse de argumentos ───────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --user)     DOCKERHUB_USER="$2"; shift 2 ;;
    --tag)      TAG="$2";            shift 2 ;;
    --no-cache) NO_CACHE="--no-cache"; shift ;;
    --push-only) PUSH_ONLY=true;     shift ;;
    *) echo "Opção desconhecida: $1"; exit 1 ;;
  esac
done

# ── Validações ────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

if [[ "$(basename "$PWD")" != "plex_server" && "$PWD" != "$ROOT_DIR" ]]; then
  echo "AVISO: Execute a partir da pasta plex_server/"
  echo "  cd $ROOT_DIR && ./musicsage/build-and-push.sh"
  echo ""
  echo "Tentando mudar para $ROOT_DIR ..."
  cd "$ROOT_DIR"
fi

if [[ -z "$DOCKERHUB_USER" ]]; then
  read -rp "Usuário DockerHub: " DOCKERHUB_USER
  [[ -z "$DOCKERHUB_USER" ]] && { echo "Usuário obrigatório."; exit 1; }
fi

FULL_IMAGE="${DOCKERHUB_USER}/${IMAGE_NAME}:${TAG}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  MusicSage  →  ${FULL_IMAGE}"
echo "  Contexto   →  $PWD"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Login no DockerHub ────────────────────────────────────────────────────────
echo "Fazendo login no DockerHub (usuário: $DOCKERHUB_USER) ..."
docker login --username "$DOCKERHUB_USER"
echo ""

# ── Build ─────────────────────────────────────────────────────────────────────
if [[ "$PUSH_ONLY" == false ]]; then
  echo "Buildando ${FULL_IMAGE} ..."
  docker build \
    $NO_CACHE \
    --file musicsage/Dockerfile \
    --tag "${FULL_IMAGE}" \
    --label "org.opencontainers.image.title=MusicSage" \
    --label "org.opencontainers.image.description=Plex music dashboard with AI analysis" \
    --label "org.opencontainers.image.created=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --label "org.opencontainers.image.version=${TAG}" \
    .
  echo ""
  echo "Build concluído: ${FULL_IMAGE}"
fi

# ── Push ──────────────────────────────────────────────────────────────────────
echo ""
read -rp "Enviar para DockerHub? [S/n] " CONFIRM
CONFIRM="${CONFIRM:-S}"

if [[ "${CONFIRM,,}" == "s" ]]; then
  echo "Fazendo push de ${FULL_IMAGE} ..."
  docker push "${FULL_IMAGE}"
  echo ""
  echo "✓ Imagem disponível em: https://hub.docker.com/r/${DOCKERHUB_USER}/${IMAGE_NAME}"
else
  echo "Push cancelado. A imagem existe localmente como ${FULL_IMAGE}."
fi
