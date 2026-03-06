"""
TideCaller — Testes unitários para download_artist.py (TDD)
Execução via plex-cli: node plex-cli.js tidecaller:test
Execução direta:       pytest scripts/tests/
"""
import sys
import os
from pathlib import Path
from unittest.mock import patch, MagicMock

AGENT_DIR = Path(__file__).parent.parent.parent  # agents/TideCaller/
SCRIPTS_DIR = AGENT_DIR / "scripts"

sys.path.insert(0, str(SCRIPTS_DIR))


# ─────────────────────────────────────────────────────────────────────────────
# Bloco 1 — Sanidade do módulo
# ─────────────────────────────────────────────────────────────────────────────

def test_modulo_importa_sem_erro():
    import download_artist  # noqa: F401


def test_nao_usa_docker_no_codigo():
    src = (SCRIPTS_DIR / "download_artist.py").read_text()
    assert "docker" not in src.lower(), \
        "download_artist.py ainda contém referência a 'docker'"


def test_nao_usa_docker_compose():
    src = (SCRIPTS_DIR / "download_artist.py").read_text()
    assert "docker-compose" not in src and "docker compose" not in src


def test_sem_bump_token_expiry():
    """Hack de manipulação de token_expiry era workaround de Docker — removido."""
    src = (SCRIPTS_DIR / "download_artist.py").read_text()
    assert "bump_token_expiry" not in src


# ─────────────────────────────────────────────────────────────────────────────
# Bloco 2 — download_url usa o venv rip
# ─────────────────────────────────────────────────────────────────────────────

def test_download_url_chama_rip_do_venv():
    import download_artist as da

    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0)
        da.download_url("https://tidal.com/browse/album/123")

    cmd = mock_run.call_args[0][0]
    assert str(cmd[0]).endswith("rip"), f"Esperado 'rip', obteve: {cmd[0]}"
    assert ".venv_tidal" in str(cmd[0]), f"rip deve vir do .venv_tidal: {cmd[0]}"


def test_download_url_passa_subcomando_url_e_endereco():
    import download_artist as da

    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0)
        da.download_url("https://tidal.com/browse/album/999")

    cmd = mock_run.call_args[0][0]
    assert "url" in cmd
    assert "https://tidal.com/browse/album/999" in cmd


def test_download_url_define_xdg_config_home():
    import download_artist as da

    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0)
        da.download_url("https://tidal.com/browse/album/1")

    env = mock_run.call_args[1].get("env", {})
    assert "XDG_CONFIG_HOME" in env
    assert "config" in env["XDG_CONFIG_HOME"]


def test_download_url_retorna_true_em_sucesso():
    import download_artist as da

    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0)
        assert da.download_url("https://tidal.com/browse/album/1") is True


def test_download_url_retorna_false_em_falha():
    import download_artist as da

    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=1)
        assert da.download_url("https://tidal.com/browse/album/1") is False


# ─────────────────────────────────────────────────────────────────────────────
# Bloco 3 — album_url e album_label
# ─────────────────────────────────────────────────────────────────────────────

def test_album_url_formato_correto():
    import download_artist as da

    album = MagicMock()
    album.id = 12345
    assert da.album_url(album) == "https://tidal.com/browse/album/12345"


def test_album_label_com_data():
    import download_artist as da
    from datetime import date

    album = MagicMock()
    album.name = "Tormento"
    album.release_date = date(2020, 5, 1)
    label = da.album_label(album)
    assert "Tormento" in label
    assert "2020" in label


def test_album_label_sem_data():
    import download_artist as da

    album = MagicMock()
    album.name = "Sem Data"
    album.release_date = None
    label = da.album_label(album)
    assert "Sem Data" in label



# ─────────────────────────────────────────────────────────────────────────────
# Bloco 1 — Sanidade do módulo
# ─────────────────────────────────────────────────────────────────────────────

def test_modulo_importa_sem_erro():
    """O módulo deve importar sem erros (sem side-effects no import)."""
    import download_artist  # noqa: F401


def test_nao_usa_docker_no_codigo():
    """download_artist.py não deve conter chamadas a docker."""
    src = (SCRIPTS_DIR / "download_artist.py").read_text()
    assert "docker" not in src.lower(), \
        "download_artist.py ainda contém referência a 'docker'"


def test_nao_usa_docker_compose_no_codigo():
    src = (SCRIPTS_DIR / "download_artist.py").read_text()
    assert "docker-compose" not in src and "docker compose" not in src, \
        "download_artist.py ainda chama docker-compose"


# ─────────────────────────────────────────────────────────────────────────────
# Bloco 2 — download_url usa o venv rip
# ─────────────────────────────────────────────────────────────────────────────

def test_download_url_chama_rip_do_venv():
    """download_url deve executar o binário rip do .venv_tidal."""
    import download_artist as da

    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0)
        da.download_url("https://tidal.com/browse/album/123")

    assert mock_run.called, "subprocess.run não foi chamado"
    cmd = mock_run.call_args[0][0]
    # primeiro argumento deve ser o binário rip do venv
    assert str(cmd[0]).endswith("rip"), \
        f"Esperado 'rip' como comando, obteve: {cmd[0]}"
    assert ".venv_tidal" in str(cmd[0]), \
        f"rip deve vir do .venv_tidal, obteve: {cmd[0]}"


def test_download_url_passa_subcomando_url():
    """download_url deve passar o subcomando 'url' e a URL ao rip."""
    import download_artist as da

    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0)
        da.download_url("https://tidal.com/browse/album/999")

    cmd = mock_run.call_args[0][0]
    assert "url" in cmd, f"Subcomando 'url' ausente: {cmd}"
    assert "https://tidal.com/browse/album/999" in cmd, \
        f"URL ausente nos argumentos: {cmd}"


def test_download_url_define_xdg_config_home():
    """download_url deve definir XDG_CONFIG_HOME apontando para config/ do agente."""
    import download_artist as da

    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0)
        da.download_url("https://tidal.com/browse/album/1")

    kwargs = mock_run.call_args[1]
    env = kwargs.get("env", {})
    assert "XDG_CONFIG_HOME" in env, "XDG_CONFIG_HOME não foi passado ao subprocess"
    assert "config" in env["XDG_CONFIG_HOME"], \
        f"XDG_CONFIG_HOME não aponta para config/: {env['XDG_CONFIG_HOME']}"


def test_download_url_retorna_true_em_sucesso():
    import download_artist as da

    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0)
        result = da.download_url("https://tidal.com/browse/album/1")

    assert result is True


def test_download_url_retorna_false_em_falha():
    import download_artist as da

    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=1)
        result = da.download_url("https://tidal.com/browse/album/1")

    assert result is False


# ─────────────────────────────────────────────────────────────────────────────
# Bloco 3 — Sem hacks de token_expiry
# ─────────────────────────────────────────────────────────────────────────────

def test_sem_bump_token_expiry():
    """O hack bump_token_expiry era necessário para Docker; não deve existir mais."""
    src = (SCRIPTS_DIR / "download_artist.py").read_text()
    assert "bump_token_expiry" not in src, \
        "bump_token_expiry ainda existe — era um hack para Docker, remova-o"


# ─────────────────────────────────────────────────────────────────────────────
# Bloco 4 — album_url e album_label
# ─────────────────────────────────────────────────────────────────────────────

def test_album_url_formato_correto():
    import download_artist as da

    album = MagicMock()
    album.id = 12345
    url = da.album_url(album)
    assert url == "https://tidal.com/browse/album/12345"


def test_album_label_com_data():
    import download_artist as da
    from datetime import date

    album = MagicMock()
    album.name = "Tormento"
    album.release_date = date(2020, 5, 1)
    label = da.album_label(album)
    assert "Tormento" in label
    assert "2020" in label


def test_album_label_sem_data():
    import download_artist as da

    album = MagicMock()
    album.name = "Sem Data"
    album.release_date = None
    label = da.album_label(album)
    assert "Sem Data" in label
