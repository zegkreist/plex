#!/bin/bash

# Obter diretório do script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=========================================="
echo "  Tidal Token Generator"
echo "=========================================="
echo ""

# Verificar se Python está instalado
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 não está instalado"
    exit 1
fi

echo "✅ Python 3 encontrado"
echo ""

# Criar ambiente virtual se não existir
VENV_DIR="$SCRIPT_DIR/.venv_tidal"

if [ ! -d "$VENV_DIR" ]; then
    echo "📦 Criando ambiente virtual..."
    python3 -m venv "$VENV_DIR"
    
    if [ $? -ne 0 ]; then
        echo "❌ Erro ao criar ambiente virtual"
        echo "Tente instalar python3-venv:"
        echo "  sudo apt install python3-venv"
        exit 1
    fi
    echo "✅ Ambiente virtual criado"
fi

# Ativar ambiente virtual
source "$VENV_DIR/bin/activate"

# Verificar se tidalapi está instalado no venv
if ! python -c "import tidalapi" 2>/dev/null; then
    echo "📦 Instalando tidalapi no ambiente virtual..."
    pip install tidalapi --quiet
    
    if [ $? -ne 0 ]; then
        echo ""
        echo "❌ Erro ao instalar tidalapi"
        deactivate
        exit 1
    fi
    echo "✅ tidalapi instalado com sucesso"
    echo ""
fi

# Executar o script Python
echo "🚀 Iniciando processo de autenticação..."
echo ""

python "$SCRIPT_DIR/get_tidal_tokens.py"

RESULT=$?

# Desativar ambiente virtual
deactivate

if [ $RESULT -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "  Configuração do Tidal"
    echo "=========================================="
    echo ""
    
    if [ -f "$SCRIPT_DIR/tidal_tokens.txt" ]; then
        echo "Os tokens foram salvos em: $SCRIPT_DIR/tidal_tokens.txt"
        echo ""
        echo "Para configurar o streamrip:"
        echo "  1. Abra: $SCRIPT_DIR/../config/.config/streamrip/config.toml"
        echo "  2. Localize a seção [tidal]"
        echo "  3. Substitua os valores pelos tokens gerados"
        echo ""
        echo "Ou copie e cole o conteúdo de tidal_tokens.txt"
        echo ""
        
        # Perguntar se quer abrir o arquivo de config
        read -p "Deseja abrir o arquivo de configuração agora? (s/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[SsYy]$ ]]; then
            CONFIG_PATH="$SCRIPT_DIR/../config/.config/streamrip/config.toml"
            if command -v nano &> /dev/null; then
                nano "$CONFIG_PATH"
            elif command -v vim &> /dev/null; then
                vim "$CONFIG_PATH"
            elif command -v vi &> /dev/null; then
                vi "$CONFIG_PATH"
            else
                echo "Editor não encontrado. Abra manualmente:"
                echo "  $CONFIG_PATH"
            fi
        fi
    fi
fi
