#!/bin/bash
#
# Script para enriquecer metadados usando MusicBrainz
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
NODEJS_DIR="$SCRIPT_DIR/nodejs"

echo "═══════════════════════════════════════════════════════════"
echo "    🎵 Enriquecedor de Metadados"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Verificar se o library_analysis.json existe
if [ ! -f "$PROJECT_ROOT/library_analysis.json" ]; then
    echo "❌ Arquivo library_analysis.json não encontrado!"
    echo ""
    echo "Execute primeiro: ./scripts/analyze_library.sh"
    exit 1
fi

echo "📖 Arquivo de entrada: library_analysis.json"
echo "💾 Arquivo de saída: library_enriched.json"
echo ""
echo "⚠️  ATENÇÃO: Este processo pode demorar vários minutos!"
echo "   (Rate limit: 1 request/segundo no MusicBrainz)"
echo ""
read -p "Deseja continuar? (s/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[SsYy]$ ]]; then
    echo "Cancelado."
    exit 0
fi

echo ""

# Executar enriquecimento
cd "$PROJECT_ROOT"
node "$NODEJS_DIR/enrich_metadata.mjs"

echo ""
echo "✅ Concluído!"
echo ""
echo "Próximos passos:"
echo "  • Ver álbuns: cat library_enriched.json | jq '.albums[] | {artist, album: .album_name, tracks: .downloaded_tracks}'"
echo "  • Ver incompletos: cat library_enriched.json | jq '.albums[] | select(.is_complete == false)'"
