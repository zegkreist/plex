#!/usr/bin/env bash
set -euo pipefail

# Instala e configura o NVIDIA Container Toolkit para Docker.
# Suporte: Ubuntu/Debian (apt) e Fedora/RHEL/CentOS (dnf/yum).

log() {
  printf '[INFO] %s\n' "$*"
}

warn() {
  printf '[WARN] %s\n' "$*"
}

err() {
  printf '[ERROR] %s\n' "$*" >&2
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    err "Comando obrigatorio nao encontrado: $cmd"
    exit 1
  fi
}

if [[ "${EUID}" -ne 0 ]]; then
  err "Execute com sudo: sudo ./setup-nvidia-docker.sh"
  exit 1
fi

require_cmd curl
require_cmd gpg
require_cmd sed

if [[ ! -f /etc/os-release ]]; then
  err "Nao foi possivel detectar a distribuicao (faltando /etc/os-release)."
  exit 1
fi

# shellcheck disable=SC1091
source /etc/os-release

if ! command -v docker >/dev/null 2>&1; then
  err "Docker nao encontrado. Instale o Docker antes de continuar."
  exit 1
fi

log "Distribuicao detectada: ${ID:-unknown} ${VERSION_ID:-unknown}"

install_deb_like() {
  local repo_url
  local repo_tmp
  repo_url="https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list"
  repo_tmp="$(mktemp)"

  log "Configurando repositorio NVIDIA (apt)..."
  curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey \
    | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg

  curl -fsSL "${repo_url}" \
    | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' \
    > "${repo_tmp}"

  if ! grep -Eq '^deb\s' "${repo_tmp}"; then
    rm -f "${repo_tmp}"
    err "Repositorio NVIDIA invalido (resposta nao contem entrada deb)."
    exit 1
  fi

  install -m 0644 "${repo_tmp}" /etc/apt/sources.list.d/nvidia-container-toolkit.list
  rm -f "${repo_tmp}"

  log "Instalando nvidia-container-toolkit..."
  apt-get update
  apt-get install -y nvidia-container-toolkit
}

install_rpm_like() {
  local pkg_manager=""

  if command -v dnf >/dev/null 2>&1; then
    pkg_manager="dnf"
  elif command -v yum >/dev/null 2>&1; then
    pkg_manager="yum"
  else
    err "Nenhum gerenciador de pacotes RPM encontrado (dnf/yum)."
    exit 1
  fi

  log "Configurando repositorio NVIDIA (${pkg_manager})..."
  curl -s -L https://nvidia.github.io/libnvidia-container/stable/rpm/nvidia-container-toolkit.repo \
    > /etc/yum.repos.d/nvidia-container-toolkit.repo

  log "Instalando nvidia-container-toolkit..."
  "$pkg_manager" install -y nvidia-container-toolkit
}

case "${ID}" in
  ubuntu|debian)
    install_deb_like
    ;;
  fedora|rhel|centos|rocky|almalinux)
    install_rpm_like
    ;;
  *)
    warn "Distribuicao nao mapeada automaticamente (${ID}). Tentando instalacao tipo Debian como fallback."
    if command -v apt-get >/dev/null 2>&1; then
      install_deb_like
    else
      err "Nao foi possivel instalar automaticamente nesta distribuicao."
      exit 1
    fi
    ;;
esac

log "Configurando runtime NVIDIA no Docker..."
require_cmd nvidia-ctk
nvidia-ctk runtime configure --runtime=docker

log "Reiniciando servico Docker..."
if command -v systemctl >/dev/null 2>&1; then
  systemctl restart docker
else
  warn "systemctl nao encontrado. Reinicie o servico Docker manualmente."
fi

log "Teste rapido do runtime NVIDIA no Docker..."
if docker run --rm --gpus all nvidia/cuda:12.0.0-base-ubuntu22.04 nvidia-smi >/dev/null 2>&1; then
  log "Teste OK: NVIDIA runtime funcional no Docker."
else
  warn "Teste falhou. Verifique driver NVIDIA no host (nvidia-smi) e logs do Docker."
fi

log "Concluido."
