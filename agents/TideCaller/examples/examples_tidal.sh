#!/bin/bash

# Script de exemplo mostrando como usar o tidal.sh

echo "════════════════════════════════════════════════════════"
echo "  Exemplos de uso do tidal.sh"
echo "════════════════════════════════════════════════════════"
echo ""

# Carregar as funções
source tidal.sh

echo "✅ Funções carregadas com sucesso!"
echo ""

echo "Exemplos disponíveis:"
echo ""

echo "1. Download de álbum:"
echo "   tidal_album \"https://tidal.com/browse/album/123456\" 3"
echo ""

echo "2. Download de playlist:"
echo "   tidal_playlist \"https://tidal.com/browse/playlist/uuid\" 3"
echo ""

echo "3. Buscar e baixar álbum:"
echo "   tidal_search_album \"daft punk discovery\""
echo "   tidal_search_album \"thriller\" auto  # Baixa automaticamente"
echo ""

echo "4. Buscar artista:"
echo "   tidal_search_artist \"pink floyd\""
echo ""

echo "5. Download por ID:"
echo "   tidal_id album 123456789 3"
echo ""

echo "6. Converter para MP3:"
echo "   tidal_album_mp3 \"https://tidal.com/browse/album/123456\""
echo ""

echo "7. Ver informações de qualidade:"
echo "   tidal_quality_info"
echo ""

echo "8. Ver histórico:"
echo "   tidal_history"
echo ""

echo "════════════════════════════════════════════════════════"
echo "Para usar o menu interativo:"
echo "  ./tidal.sh menu"
echo ""
echo "Para ver a ajuda completa:"
echo "  ./tidal.sh help"
echo ""
echo "Para ver o guia completo:"
echo "  cat TIDAL_GUIDE.md"
echo "════════════════════════════════════════════════════════"
