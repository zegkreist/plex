#!/bin/bash
# Script wrapper para organizar músicas por álbum

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "======================================================================"
echo "🎵 Organizando biblioteca por álbuns"
echo "======================================================================"
echo ""

cd "$SCRIPT_DIR/nodejs"
node organize_by_albums.mjs

echo ""
echo "✅ Organização concluída!"
echo ""
