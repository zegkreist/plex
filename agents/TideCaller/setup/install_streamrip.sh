#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$(dirname "$SCRIPT_DIR")"
VENV="$AGENT_DIR/.venv_tidal"

echo "==================================="
echo "   Streamrip — Instalação (venv)"
echo "==================================="
echo ""

# Verificar Python 3
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 não encontrado. Instale python3 e tente novamente."
    exit 1
fi

echo "✅ Python 3: $(python3 --version)"

# Avisar sobre ffmpeg (dependência do streamrip para conversão)
if ! command -v ffmpeg &> /dev/null; then
    echo "⚠️  ffmpeg não encontrado — conversão de áudio não estará disponível."
    echo "   Instale com: sudo apt install ffmpeg"
else
    echo "✅ ffmpeg: $(ffmpeg -version 2>&1 | head -1)"
fi
echo ""

# Criar venv se não existir
if [[ ! -d "$VENV" ]]; then
    echo "📦 Criando virtualenv em .venv_tidal..."
    python3 -m venv "$VENV"
else
    echo "✅ Virtualenv já existe em .venv_tidal"
fi

# Garantir que pip está disponível
if ! "$VENV/bin/python3" -m pip --version &>/dev/null; then
    echo "📦 Inicializando pip no venv..."
    "$VENV/bin/python3" -m ensurepip
fi

echo ""
echo "📦 Instalando streamrip e tidalapi..."
"$VENV/bin/python3" -m pip install --upgrade pip --quiet
"$VENV/bin/python3" -m pip install streamrip tidalapi --quiet

echo ""
echo "==================================="
echo "✅ Instalação concluída!"
echo "==================================="
echo ""
echo "📚 Próximos passos:"
echo ""
echo "1. Configure o streamrip:"
echo "   bash $AGENT_DIR/scripts/rip.sh config open"
echo ""
echo "2. Edite o arquivo de configuração em:"
echo "   $AGENT_DIR/config/.config/streamrip/config.toml"
echo ""
echo "3. Autentique no Tidal:"
echo "   bash $AGENT_DIR/setup/setup_tidal.sh"
echo ""
echo "4. Baixe um álbum:"
echo "   bash $AGENT_DIR/scripts/rip.sh url <URL_DO_ALBUM>"
echo ""

if [ $? -eq 0 ]; then
    echo ""
    echo "==================================="
    echo "✅ Instalação concluída com sucesso!"
    echo "==================================="
    echo ""
    echo "📚 Próximos passos:"
    echo ""
    echo "1. Configure o streamrip:"
    echo "   ./rip.sh config open"
    echo ""
    echo "2. Edite o arquivo de configuração em:"
    echo "   ./config/.config/streamrip/config.toml"
    echo "   (Adicione suas credenciais de Qobuz, Tidal ou Deezer)"
    echo ""
    echo "3. Teste com o comando de ajuda:"
    echo "   ./rip.sh --help"
    echo ""
    echo "4. Baixe uma música/álbum:"
    echo "   ./rip.sh url <URL_DO_ALBUM>"
    echo ""
    echo "📖 Para mais informações, consulte o readme.md"
    echo ""
else
    echo ""
    echo "❌ Erro ao construir a imagem Docker"
    exit 1
fi
