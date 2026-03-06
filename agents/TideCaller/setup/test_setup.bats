#!/usr/bin/env bats
#
# TideCaller — Testes de setup (TDD)
# Execução: bats setup/test_setup.bats  (a partir de agents/TideCaller/)
#

setup() {
  AGENT_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)"
  VENV="$AGENT_DIR/.venv_tidal"
  CONFIG_DIR="$AGENT_DIR/config/.config/streamrip"
  CONFIG_TOML="$CONFIG_DIR/config.toml"
}

# ─────────────────────────────────────────────────────────────────────────────
# BLOCO 1 — Pré-requisitos do sistema
# ─────────────────────────────────────────────────────────────────────────────

@test "[sistema] python3 está disponível" {
  run python3 --version
  [ "$status" -eq 0 ]
}

@test "[sistema] setup/setup.sh existe" {
  [ -f "$AGENT_DIR/setup/setup.sh" ]
}

@test "[sistema] setup/setup.sh é executável" {
  [ -x "$AGENT_DIR/setup/setup.sh" ]
}

@test "[sistema] setup/config.toml.template existe no repo" {
  [ -f "$AGENT_DIR/setup/config.toml.template" ]
}

# ─────────────────────────────────────────────────────────────────────────────
# BLOCO 2 — Virtualenv
# ─────────────────────────────────────────────────────────────────────────────

@test "[venv] diretório .venv_tidal existe" {
  [ -d "$VENV" ]
}

@test "[venv] python3 do venv é executável" {
  [ -x "$VENV/bin/python3" ]
}

@test "[venv] pip está disponível no venv" {
  run "$VENV/bin/python3" -m pip --version
  [ "$status" -eq 0 ]
}

# ─────────────────────────────────────────────────────────────────────────────
# BLOCO 3 — Dependências Python
# ─────────────────────────────────────────────────────────────────────────────

@test "[deps] tidalapi está instalado no venv" {
  run "$VENV/bin/python3" -c "import tidalapi"
  [ "$status" -eq 0 ]
}

@test "[deps] streamrip está instalado no venv" {
  run "$VENV/bin/python3" -c "import streamrip"
  [ "$status" -eq 0 ]
}

@test "[deps] comando rip está disponível no venv" {
  [ -x "$VENV/bin/rip" ]
}

@test "[deps] rip --help retorna sucesso" {
  run "$VENV/bin/rip" --help
  [ "$status" -eq 0 ]
}

# ─────────────────────────────────────────────────────────────────────────────
# BLOCO 4 — Configuração
# ─────────────────────────────────────────────────────────────────────────────

@test "[config] diretório config/.config/streamrip/ existe" {
  [ -d "$CONFIG_DIR" ]
}

@test "[config] config.toml existe" {
  [ -f "$CONFIG_TOML" ]
}

@test "[config] config.toml não tem caminho Docker /downloads hardcoded" {
  run grep -P '^folder\s*=\s*"/downloads"' "$CONFIG_TOML"
  [ "$status" -ne 0 ]
}

@test "[config] config.toml aponta downloads para pasta local do agente" {
  local line
  line="$(grep -E '^folder\s*=' "$CONFIG_TOML" | head -1)"
  [[ "$line" == *"$AGENT_DIR"* ]]
}

@test "[config] config.toml aponta downloads.db para pasta local do agente" {
  local line
  line="$(grep 'downloads_path' "$CONFIG_TOML" | head -1)"
  [[ "$line" == *"$AGENT_DIR"* ]]
}

@test "[config] config.toml não contém placeholder __AGENT_DIR__" {
  run grep "__AGENT_DIR__" "$CONFIG_TOML"
  [ "$status" -ne 0 ]
}

# ─────────────────────────────────────────────────────────────────────────────
# BLOCO 5 — Scripts executáveis
# ─────────────────────────────────────────────────────────────────────────────

@test "[scripts] scripts/rip.sh é executável" {
  [ -x "$AGENT_DIR/scripts/rip.sh" ]
}

@test "[scripts] scripts/download_artist.sh é executável" {
  [ -x "$AGENT_DIR/scripts/download_artist.sh" ]
}

@test "[scripts] scripts/refresh_token.sh é executável" {
  [ -x "$AGENT_DIR/scripts/refresh_token.sh" ]
}

@test "[scripts] scripts/tidal.sh é executável" {
  [ -x "$AGENT_DIR/scripts/tidal.sh" ]
}

@test "[scripts] setup/get_tidal_tokens.py existe" {
  [ -f "$AGENT_DIR/setup/get_tidal_tokens.py" ]
}

# ─────────────────────────────────────────────────────────────────────────────
# BLOCO 6 — Auto-setup via plex-cli (guard)
# ─────────────────────────────────────────────────────────────────────────────

@test "[auto-setup] setup/ensure_setup.sh existe" {
  [ -f "$AGENT_DIR/setup/ensure_setup.sh" ]
}

@test "[auto-setup] setup/ensure_setup.sh é executável" {
  [ -x "$AGENT_DIR/setup/ensure_setup.sh" ]
}

@test "[auto-setup] scripts/rip.sh sourca ensure_setup.sh" {
  run grep -q "ensure_setup" "$AGENT_DIR/scripts/rip.sh"
  [ "$status" -eq 0 ]
}

@test "[auto-setup] scripts/download_artist.sh sourca ensure_setup.sh" {
  run grep -q "ensure_setup" "$AGENT_DIR/scripts/download_artist.sh"
  [ "$status" -eq 0 ]
}

@test "[auto-setup] scripts/download_artists.sh sourca ensure_setup.sh" {
  run grep -q "ensure_setup" "$AGENT_DIR/scripts/download_artists.sh"
  [ "$status" -eq 0 ]
}

@test "[auto-setup] scripts/refresh_token.sh sourca ensure_setup.sh" {
  run grep -q "ensure_setup" "$AGENT_DIR/scripts/refresh_token.sh"
  [ "$status" -eq 0 ]
}

@test "[auto-setup] tidal.sh sourca ensure_setup.sh" {
  run grep -q "ensure_setup" "$AGENT_DIR/scripts/tidal.sh"
  [ "$status" -eq 0 ]
}

@test "[auto-setup] ensure_setup.sh chama setup.sh quando venv ausente" {
  run grep -q "setup.sh" "$AGENT_DIR/setup/ensure_setup.sh"
  [ "$status" -eq 0 ]
}

# ─────────────────────────────────────────────────────────────────────────────
# BLOCO 7 — Renovação automática de token em caso de falha de auth
# ─────────────────────────────────────────────────────────────────────────────

@test "[token] setup/token_guard.sh existe" {
  [ -f "$AGENT_DIR/setup/token_guard.sh" ]
}

@test "[token] setup/token_guard.sh é executável" {
  [ -x "$AGENT_DIR/setup/token_guard.sh" ]
}

@test "[token] scripts/rip.sh usa token_guard para executar o rip" {
  run grep -q "token_guard" "$AGENT_DIR/scripts/rip.sh"
  [ "$status" -eq 0 ]
}

@test "[token] scripts/tidal.sh rip_cmd usa token_guard" {
  run grep -q "token_guard" "$AGENT_DIR/scripts/tidal.sh"
  [ "$status" -eq 0 ]
}

@test "[token] token_guard.sh detecta erros de autenticação do streamrip" {
  run grep -qiE "401|unauthorized|token|auth|login" "$AGENT_DIR/setup/token_guard.sh"
  [ "$status" -eq 0 ]
}

@test "[token] token_guard.sh chama refresh_token.sh ao detectar falha de auth" {
  run grep -q "refresh_token" "$AGENT_DIR/setup/token_guard.sh"
  [ "$status" -eq 0 ]
}

@test "[token] token_guard.sh reencarrega o comando após refresh bem-sucedido" {
  # deve haver algum retry/reexec após o refresh
  run grep -qE 'retry|re-?exec|second|novamente|\$@' "$AGENT_DIR/setup/token_guard.sh"
  [ "$status" -eq 0 ]
}
