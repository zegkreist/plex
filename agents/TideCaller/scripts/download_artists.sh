#!/usr/bin/env bash
# Script de download de discografia
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Auto-setup: instala venv + deps se necessário
source "$PROJECT_ROOT/setup/ensure_setup.sh"

# Carregar funções do tidal.sh
source "$SCRIPT_DIR/tidal.sh"

echo "======================================================================"
echo "📀 Download de Discografias via Streamrip"
echo "======================================================================"
echo ""
echo "Artistas a baixar: 9"
echo ""


echo "----------------------------------------------------------------------"
echo "🎤 [1/9] Baixando: Fleshgod Apocalypse"
echo "   • Álbuns encontrados na biblioteca: 3"
echo "   • Total de faixas: 13"
echo "----------------------------------------------------------------------"
echo ""

# Buscar artista no Tidal usando tidal.sh
cd "$PROJECT_ROOT"
tidal_search_artist "Fleshgod Apocalypse"

echo ""
echo "✅ Concluído: Fleshgod Apocalypse"
echo ""

# Rate limit (respeitar servidores)
sleep 2


echo "----------------------------------------------------------------------"
echo "🎤 [2/9] Baixando: Gaupa"
echo "   • Álbuns encontrados na biblioteca: 6"
echo "   • Total de faixas: 13"
echo "----------------------------------------------------------------------"
echo ""

# Buscar artista no Tidal usando tidal.sh
cd "$PROJECT_ROOT"
tidal_search_artist "Gaupa"

echo ""
echo "✅ Concluído: Gaupa"
echo ""

# Rate limit (respeitar servidores)
sleep 2


echo "----------------------------------------------------------------------"
echo "🎤 [3/9] Baixando: King Buffalo"
echo "   • Álbuns encontrados na biblioteca: 4"
echo "   • Total de faixas: 8"
echo "----------------------------------------------------------------------"
echo ""

# Buscar artista no Tidal usando tidal.sh
cd "$PROJECT_ROOT"
tidal_search_artist "King Buffalo"

echo ""
echo "✅ Concluído: King Buffalo"
echo ""

# Rate limit (respeitar servidores)
sleep 2


echo "----------------------------------------------------------------------"
echo "🎤 [4/9] Baixando: Colour Haze"
echo "   • Álbuns encontrados na biblioteca: 1"
echo "   • Total de faixas: 1"
echo "----------------------------------------------------------------------"
echo ""

# Buscar artista no Tidal usando tidal.sh
cd "$PROJECT_ROOT"
tidal_search_artist "Colour Haze"

echo ""
echo "✅ Concluído: Colour Haze"
echo ""

# Rate limit (respeitar servidores)
sleep 2


echo "----------------------------------------------------------------------"
echo "🎤 [5/9] Baixando: Melechesh"
echo "   • Álbuns encontrados na biblioteca: 1"
echo "   • Total de faixas: 1"
echo "----------------------------------------------------------------------"
echo ""

# Buscar artista no Tidal usando tidal.sh
cd "$PROJECT_ROOT"
tidal_search_artist "Melechesh"

echo ""
echo "✅ Concluído: Melechesh"
echo ""

# Rate limit (respeitar servidores)
sleep 2


echo "----------------------------------------------------------------------"
echo "🎤 [6/9] Baixando: Mars Red Sky"
echo "   • Álbuns encontrados na biblioteca: 1"
echo "   • Total de faixas: 1"
echo "----------------------------------------------------------------------"
echo ""

# Buscar artista no Tidal usando tidal.sh
cd "$PROJECT_ROOT"
tidal_search_artist "Mars Red Sky"

echo ""
echo "✅ Concluído: Mars Red Sky"
echo ""

# Rate limit (respeitar servidores)
sleep 2


echo "----------------------------------------------------------------------"
echo "🎤 [7/9] Baixando: The Green Kingdom"
echo "   • Álbuns encontrados na biblioteca: 1"
echo "   • Total de faixas: 11"
echo "----------------------------------------------------------------------"
echo ""

# Buscar artista no Tidal usando tidal.sh
cd "$PROJECT_ROOT"
tidal_search_artist "The Green Kingdom"

echo ""
echo "✅ Concluído: The Green Kingdom"
echo ""

# Rate limit (respeitar servidores)
sleep 2


echo "----------------------------------------------------------------------"
echo "🎤 [8/9] Baixando: Russian Circles"
echo "   • Álbuns encontrados na biblioteca: 4"
echo "   • Total de faixas: 4"
echo "----------------------------------------------------------------------"
echo ""

# Buscar artista no Tidal usando tidal.sh
cd "$PROJECT_ROOT"
tidal_search_artist "Russian Circles"

echo ""
echo "✅ Concluído: Russian Circles"
echo ""

# Rate limit (respeitar servidores)
sleep 2


echo "----------------------------------------------------------------------"
echo "🎤 [9/9] Baixando: My Sleeping Karma"
echo "   • Álbuns encontrados na biblioteca: 3"
echo "   • Total de faixas: 3"
echo "----------------------------------------------------------------------"
echo ""

# Buscar artista no Tidal usando tidal.sh
cd "$PROJECT_ROOT"
tidal_search_artist "My Sleeping Karma"

echo ""
echo "✅ Concluído: My Sleeping Karma"
echo ""

# Rate limit (respeitar servidores)
sleep 2


echo "======================================================================"
echo "✅ DOWNLOAD CONCLUÍDO - Todos os artistas processados"
echo "======================================================================"
echo ""
echo "📂 Arquivos salvos em: $PROJECT_ROOT/downloads/"
echo ""
