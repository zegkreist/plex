#!/bin/bash
# ollama-install.sh — Instalação automatizada do Ollama no host

set -e

# Verifica se já está instalado
if command -v ollama >/dev/null 2>&1; then
  echo "Ollama já está instalado."
  ollama --version
  exit 0
fi

# Instalação oficial
curl -fsSL https://ollama.com/install.sh | sh

echo "Ollama instalado com sucesso!"
echo "Para iniciar o serviço, execute: ollama serve"
echo "Para testar, execute: curl http://localhost:11434/api/info"
