#!/bin/sh
# docker-entrypoint.sh — extrai PLEX_TOKEN do Preferences.xml se não fornecido via env

set -e

if [ -z "$PLEX_TOKEN" ] && [ -n "$PLEX_CONFIG_DIR" ]; then
  PREFS="$PLEX_CONFIG_DIR/Library/Application Support/Plex Media Server/Preferences.xml"
  if [ -f "$PREFS" ]; then
    # sed funciona no BusyBox (Alpine) — grep -P não funciona
    TOKEN=$(sed -n 's/.*PlexOnlineToken="\([^"]*\)".*/\1/p' "$PREFS" | head -1)
    if [ -n "$TOKEN" ]; then
      export PLEX_TOKEN="$TOKEN"
      echo "[entrypoint] PLEX_TOKEN extraído do Preferences.xml"
    else
      echo "[entrypoint] AVISO: PlexOnlineToken não encontrado em $PREFS"
    fi
  else
    echo "[entrypoint] AVISO: Preferences.xml não encontrado em: $PREFS"
  fi
elif [ -n "$PLEX_TOKEN" ]; then
  echo "[entrypoint] PLEX_TOKEN recebido via variável de ambiente"
else
  echo "[entrypoint] AVISO: PLEX_TOKEN e PLEX_CONFIG_DIR não definidos"
fi

exec node index.js
