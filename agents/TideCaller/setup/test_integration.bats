#!/usr/bin/env bats
#
# TideCaller — Testes de integração via plex-cli (TDD)
#
# Execução:
#   node plex-cli.js tidecaller:test      ← via plex-cli
#   bats setup/test_integration.bats      ← direto
#
# Todos os testes usam node plex-cli.js como ponto de entrada real,
# exatamente como o usuário final faz.
#

PLEX_CLI="/home/developer/workspace/plex_server/plex-cli.js"
AGENT_DIR="/home/developer/workspace/plex_server/agents/TideCaller"
VENV="$AGENT_DIR/.venv_tidal"

# ─────────────────────────────────────────────────────────────────────────────
# BLOCO 1 — plex-cli conhece os comandos TideCaller
# ─────────────────────────────────────────────────────────────────────────────

@test "[plex-cli] tidecaller:setup está registrado" {
  run node "$PLEX_CLI" --help
  [[ "$output" == *"tidecaller:setup"* ]]
}

@test "[plex-cli] tidecaller:rip está registrado" {
  run node "$PLEX_CLI" --help
  [[ "$output" == *"tidecaller:rip"* ]]
}

@test "[plex-cli] tidecaller:download-artist está registrado" {
  run node "$PLEX_CLI" --help
  [[ "$output" == *"tidecaller:download-artist"* ]]
}

@test "[plex-cli] tidecaller:refresh-token está registrado" {
  run node "$PLEX_CLI" --help
  [[ "$output" == *"tidecaller:refresh-token"* ]]
}

@test "[plex-cli] tidecaller:test está registrado" {
  run node "$PLEX_CLI" --help
  [[ "$output" == *"tidecaller:test"* ]]
}

# ─────────────────────────────────────────────────────────────────────────────
# BLOCO 2 — tidecaller:setup via plex-cli
# ─────────────────────────────────────────────────────────────────────────────

@test "[plex-cli] tidecaller:setup completa sem erro" {
  run timeout 60 node "$PLEX_CLI" tidecaller:setup
  [ "$status" -eq 0 ]
}

@test "[plex-cli] tidecaller:setup instala venv" {
  timeout 60 node "$PLEX_CLI" tidecaller:setup >/dev/null 2>&1
  [ -x "$VENV/bin/python3" ]
}

@test "[plex-cli] tidecaller:setup instala streamrip no venv" {
  timeout 60 node "$PLEX_CLI" tidecaller:setup >/dev/null 2>&1
  run "$VENV/bin/python3" -c "import streamrip"
  [ "$status" -eq 0 ]
}

@test "[plex-cli] tidecaller:setup instala tidalapi no venv" {
  timeout 60 node "$PLEX_CLI" tidecaller:setup >/dev/null 2>&1
  run "$VENV/bin/python3" -c "import tidalapi"
  [ "$status" -eq 0 ]
}

@test "[plex-cli] tidecaller:setup cria config.toml" {
  timeout 60 node "$PLEX_CLI" tidecaller:setup >/dev/null 2>&1
  [ -f "$AGENT_DIR/config/.config/streamrip/config.toml" ]
}

@test "[plex-cli] tidecaller:setup não menciona docker no output" {
  run timeout 60 node "$PLEX_CLI" tidecaller:setup
  [[ "$output" != *"docker"* ]]
}

# ─────────────────────────────────────────────────────────────────────────────
# BLOCO 3 — tidecaller:rip via plex-cli (sem URL = erro esperado do streamrip,
#           mas NÃO erro de docker)
# ─────────────────────────────────────────────────────────────────────────────

@test "[plex-cli] tidecaller:rip não menciona docker no output" {
  # Sem URL vai retornar erro do streamrip — mas não erro de docker
  run timeout 60 node "$PLEX_CLI" tidecaller:rip
  [[ "$output" != *"docker"* ]]
  [[ "$output" != *"Docker"* ]]
}

@test "[plex-cli] tidecaller:rip usa o venv rip (não system rip)" {
  # O único rip disponível deve ser o do venv
  run bash -c "which rip 2>/dev/null || echo 'none'"
  [[ "$output" == "none" || "$output" == *".venv_tidal"* ]]
}

@test "[plex-cli] tidecaller:rip output não contém 'docker-compose'" {
  run timeout 60 node "$PLEX_CLI" tidecaller:rip
  [[ "$output" != *"docker-compose"* ]]
}

# ─────────────────────────────────────────────────────────────────────────────
# BLOCO 4 — tidecaller:download-artist via plex-cli
#           (passa nome via stdin vazio = sai imediatamente)
# ─────────────────────────────────────────────────────────────────────────────

@test "[plex-cli] tidecaller:download-artist não menciona docker no output" {
  # EOF no stdin faz o script sair graciosamente
  run bash -c "echo '' | timeout 60 node '$PLEX_CLI' tidecaller:download-artist"
  [[ "$output" != *"docker"* ]]
  [[ "$output" != *"docker-compose"* ]]
}

@test "[plex-cli] tidecaller:download-artist usa rip do venv para download" {
  # Verifica no código-fonte que não há chamada a docker
  run grep -i "docker" "$AGENT_DIR/scripts/download_artist.py"
  [ "$status" -ne 0 ]
}

@test "[plex-cli] tidecaller:download-artist usa rip do venv (sem docker-compose)" {
  run grep "docker-compose\|docker compose" "$AGENT_DIR/scripts/download_artist.py"
  [ "$status" -ne 0 ]
}

@test "[plex-cli] download_artist.py usa .venv_tidal/bin/rip para download" {
  run grep -E "venv.*rip|VENV.*rip|rip_bin|\.venv_tidal" "$AGENT_DIR/scripts/download_artist.py"
  [ "$status" -eq 0 ]
}

# ─────────────────────────────────────────────────────────────────────────────
# BLOCO 5 — Testes unitários Python via plex-cli
# ─────────────────────────────────────────────────────────────────────────────

@test "[plex-cli] tidecaller:test roda os testes unitários Python sem falha" {
  run timeout 60 node "$PLEX_CLI" tidecaller:test
  [ "$status" -eq 0 ]
}
