#!/usr/bin/env python3
"""
TideCaller — Gerenciamento de tokens Tidal para o streamrip.

Modos:
  python get_tidal_tokens.py          → refresh automático se possível, OAuth se necessário
  python get_tidal_tokens.py --force  → força novo login OAuth independente do estado atual
  python get_tidal_tokens.py --check  → só verifica expiração, sai com código 1 se expirado

Após obter tokens, substitui automaticamente os valores no config.toml.
"""

import sys
import re
import time
from pathlib import Path

# ── Caminhos ──────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent.absolute()
AGENT_DIR = SCRIPT_DIR.parent
CONFIG_TOML = AGENT_DIR / "config" / ".config" / "streamrip" / "config.toml"
TOKENS_BACKUP = SCRIPT_DIR / "tidal_tokens.txt"

# ── Importação com mensagem amigável ──────────────────────────────────────────
try:
    import tidalapi
except ImportError:
    print("❌ tidalapi não está instalado.")
    print("   Execute: pip install tidalapi  (ou use o venv: .venv_tidal)")
    sys.exit(1)


# ── Utilitários ───────────────────────────────────────────────────────────────

def read_config() -> str:
    """Lê o conteúdo atual do config.toml."""
    if not CONFIG_TOML.exists():
        print(f"⚠️  config.toml não encontrado em: {CONFIG_TOML}")
        return ""
    return CONFIG_TOML.read_text(encoding="utf-8")


def write_tokens_to_config(user_id, country_code, access_token, refresh_token, expiry):
    """
    Substitui os 5 campos do bloco [tidal] no config.toml preservando
    todos os comentários e demais seções.
    """
    content = read_config()
    if not content:
        print("⚠️  Não foi possível ler config.toml — tokens salvos apenas em backup.")
        return False

    fields = {
        "user_id": str(user_id),
        "country_code": str(country_code),
        "access_token": str(access_token),
        "refresh_token": str(refresh_token),
        "token_expiry": str(expiry),
    }

    updated = content
    for key, value in fields.items():
        # Substitui  key = "qualquer_coisa"  ou  key = "..."  dentro do arquivo
        # Usa lookahead para não cruzar para outra seção
        pattern = rf'^({re.escape(key)}\s*=\s*)"[^"]*"'
        replacement = rf'\1"{value}"'
        new = re.sub(pattern, replacement, updated, flags=re.MULTILINE)
        if new == updated:
            print(f"  ⚠️  Campo '{key}' não encontrado no config.toml")
        updated = new

    CONFIG_TOML.write_text(updated, encoding="utf-8")
    print(f"✅ config.toml atualizado: {CONFIG_TOML}")
    return True


def save_backup(user_id, country_code, access_token, refresh_token, expiry):
    """Salva cópia de segurança dos tokens em tidal_tokens.txt."""
    TOKENS_BACKUP.write_text(
        f'[tidal]\n'
        f'user_id = "{user_id}"\n'
        f'country_code = "{country_code}"\n'
        f'access_token = "{access_token}"\n'
        f'refresh_token = "{refresh_token}"\n'
        f'token_expiry = "{expiry}"\n'
        f'quality = 3\n'
        f'download_videos = true\n',
        encoding="utf-8",
    )
    print(f"💾 Backup salvo em: {TOKENS_BACKUP}")


def get_expiry_from_config() -> int:
    """Lê token_expiry do config.toml. Retorna 0 se não encontrar."""
    content = read_config()
    m = re.search(r'^token_expiry\s*=\s*"(\d+)"', content, re.MULTILINE)
    return int(m.group(1)) if m else 0


def is_token_expired(buffer_seconds: int = 300) -> bool:
    """Retorna True se o token expira nos próximos buffer_seconds segundos."""
    expiry = get_expiry_from_config()
    if expiry == 0:
        return True  # sem info = trata como expirado
    remaining = expiry - int(time.time())
    if remaining <= buffer_seconds:
        print(f"⏰ Token expira em {max(0, remaining)}s (buffer: {buffer_seconds}s) — renovação necessária.")
        return True
    days = remaining // 86400
    hours = (remaining % 86400) // 3600
    print(f"✅ Token válido por mais {days}d {hours}h.")
    return False


def load_session_from_config() -> "tidalapi.Session | None":
    """
    Tenta reutilizar tokens existentes do config.toml.
    Se o tidalapi conseguir fazer refresh automaticamente, retorna a sessão.
    Retorna None se falhar.
    """
    content = read_config()

    def extract(key):
        m = re.search(rf'^{re.escape(key)}\s*=\s*"([^"]*)"', content, re.MULTILINE)
        return m.group(1) if m else ""

    access_token = extract("access_token")
    refresh_token = extract("refresh_token")
    token_expiry = extract("token_expiry")

    if not access_token or not refresh_token:
        return None

    print("🔄 Tentando reutilizar/renovar sessão existente...")
    session = tidalapi.Session()
    try:
        # load_oauth_session aceita (token_type, access_token, refresh_token, expiry_time)
        # expiry_time deve ser datetime; convertemos de unix timestamp
        from datetime import datetime, timezone
        expiry_dt = datetime.fromtimestamp(int(token_expiry or 0), tz=timezone.utc) if token_expiry else None
        session.load_oauth_session("Bearer", access_token, refresh_token, expiry_dt)
        if session.check_login():
            print("✅ Sessão renovada com sucesso (sem interação necessária).")
            return session
    except Exception as e:
        print(f"  ↳ Falha ao reutilizar sessão: {e}")
    return None


def clickable_link(url: str, text: str = None) -> str:
    """Retorna URL com sequência OSC 8 para ser clicável em terminais modernos."""
    label = text or url
    return f"\033]8;;{url}\033\\{label}\033]8;;\033\\"


def oauth_login() -> "tidalapi.Session":
    """Inicia fluxo OAuth interativo. Requer que o usuário abra o link."""
    import subprocess, os
    session = tidalapi.Session()
    print()
    print("🔐 Iniciando autenticação OAuth2...")
    print()

    login, future = session.login_oauth()

    url = f"https://{login.verification_uri_complete}"

    print("━" * 60)
    print(f"  👉  {clickable_link(url)}  ← clique aqui ou copie o link")
    print()
    print(f"  Código: {login.user_code}")
    print("━" * 60)
    print()

    # Tentar abrir o browser automaticamente
    try:
        if subprocess.call(["xdg-open", url],
                           stdout=subprocess.DEVNULL,
                           stderr=subprocess.DEVNULL) == 0:
            print("🌐 Browser aberto automaticamente.")
        else:
            print("⚠️  Não foi possível abrir o browser. Abra o link manualmente.")
    except FileNotFoundError:
        print("⚠️  xdg-open não encontrado. Abra o link manualmente.")

    print()
    print("⏳ Aguardando autorização no browser...")

    try:
        future.result()
    except Exception as e:
        print(f"\n❌ Erro durante autenticação: {e}")
        sys.exit(1)

    if not session.check_login():
        print("\n❌ Falha no login. Tente novamente.")
        sys.exit(1)

    print("\n✅ Login OAuth concluído!")
    return session


def apply_tokens(session: "tidalapi.Session"):
    """Extrai tokens da sessão e os grava no config.toml + backup."""
    user_id = session.user.id if session.user else ""
    country_code = session.country_code or "BR"
    access_token = session.access_token or ""
    refresh_token = session.refresh_token or ""

    # Tenta ler expiry da sessão; fallback: +7 dias
    expiry = int(time.time()) + (7 * 24 * 3600)
    try:
        if hasattr(session, "expiry_time") and session.expiry_time:
            import calendar
            expiry = int(calendar.timegm(session.expiry_time.timetuple()))
    except Exception:
        pass

    print()
    print("─" * 60)
    print(f"  user_id       : {user_id}")
    print(f"  country_code  : {country_code}")
    print(f"  token_expiry  : {expiry}  ({time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime(expiry))})")
    print(f"  access_token  : {access_token[:40]}…")
    print("─" * 60)
    print()

    write_tokens_to_config(user_id, country_code, access_token, refresh_token, expiry)
    save_backup(user_id, country_code, access_token, refresh_token, expiry)


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    args = sys.argv[1:]
    force_oauth = "--force" in args
    check_only = "--check" in args

    print("=" * 60)
    print("  TideCaller — Gerenciamento de Tokens Tidal")
    print("=" * 60)
    print()

    # Modo --check: só verifica, não renova
    if check_only:
        expired = is_token_expired()
        sys.exit(1 if expired else 0)

    # Verificar expiração
    expired = is_token_expired()

    if not force_oauth and not expired:
        print("ℹ️  Token ainda válido. Use --force para forçar novo login OAuth.")
        sys.exit(0)

    # Tentar refresh automático sem login (se não for --force)
    session = None
    if not force_oauth:
        session = load_session_from_config()

    # Fallback: login OAuth interativo
    if session is None:
        session = oauth_login()

    apply_tokens(session)

    print()
    print("🎵 Pronto! streamrip já pode usar os novos tokens.")
    print()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Cancelado pelo usuário.")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Erro inesperado: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
