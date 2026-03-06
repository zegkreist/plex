#!/bin/bash

echo "==================================="
echo "   Streamrip Docker Setup"
echo "==================================="
echo ""

# Verificar se o Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker não está instalado. Por favor, instale o Docker primeiro."
    echo "   Visite: https://docs.docker.com/get-docker/"
    exit 1
fi

# Verificar se o Docker Compose está instalado
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose não está instalado. Por favor, instale o Docker Compose primeiro."
    echo "   Visite: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker e Docker Compose encontrados"
echo ""

# Tornar o script auxiliar executável
echo "📝 Tornando o script rip.sh executável..."
chmod +x rip.sh

# Construir a imagem Docker
echo ""
echo "🔨 Construindo a imagem Docker do streamrip..."
echo "   (Isso pode levar alguns minutos na primeira vez)"
docker-compose build

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
