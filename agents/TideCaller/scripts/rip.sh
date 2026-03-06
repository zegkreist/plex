#!/bin/bash

# Script auxiliar para executar streamrip via Docker
# Uso: ./rip.sh [argumentos do rip]
# Exemplo: ./rip.sh url https://www.qobuz.com/album/...

# Define UID e GID do usuário atual para evitar problemas de permissão
export USER_ID=$(id -u)
export GROUP_ID=$(id -g)

docker-compose run --rm streamrip "$@"
