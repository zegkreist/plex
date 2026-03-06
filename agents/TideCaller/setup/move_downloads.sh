#!/bin/bash

# Script para mover downloads da pasta config/ para downloads/
# Útil se você baixou músicas antes da correção

echo "=============================================="
echo "  Mover Downloads para Pasta Correta"
echo "=============================================="
echo ""

SOURCE_DIR="config/StreamripDownloads"
DEST_DIR="downloads"

# Verificar se a pasta de origem existe
if [ ! -d "$SOURCE_DIR" ]; then
    echo "✅ Tudo certo! Não há downloads na pasta config/"
    echo "   Os downloads agora vão direto para ./downloads/"
    echo ""
    exit 0
fi

# Contar arquivos
FILE_COUNT=$(find "$SOURCE_DIR" -type f 2>/dev/null | wc -l)

if [ "$FILE_COUNT" -eq 0 ]; then
    echo "✅ A pasta $SOURCE_DIR existe mas está vazia"
    echo "   Removendo pasta vazia..."
    rmdir "$SOURCE_DIR" 2>/dev/null && echo "   ✅ Pasta removida"
    echo ""
    exit 0
fi

echo "📂 Encontrados $FILE_COUNT arquivo(s) em $SOURCE_DIR"
echo ""
echo "🔄 Esta operação irá:"
echo "   1. Mover todos os arquivos de $SOURCE_DIR para $DEST_DIR"
echo "   2. Manter a estrutura de pastas"
echo "   3. Remover a pasta $SOURCE_DIR após a movimentação"
echo ""
read -p "Deseja continuar? (s/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[SsYy]$ ]]; then
    echo "❌ Operação cancelada"
    exit 0
fi

echo ""
echo "🔄 Movendo arquivos..."

# Criar diretório de destino se não existir
mkdir -p "$DEST_DIR"

# Mover arquivos mantendo estrutura
rsync -av --remove-source-files "$SOURCE_DIR/" "$DEST_DIR/"

# Remover diretórios vazios
find "$SOURCE_DIR" -type d -empty -delete

echo ""
echo "✅ Arquivos movidos com sucesso!"
echo ""
echo "📊 Estrutura final:"
ls -lh "$DEST_DIR" | head -10
echo ""

if [ -d "$SOURCE_DIR" ]; then
    echo "⚠️  A pasta $SOURCE_DIR ainda existe (pode conter subpastas)"
    echo "   Verifique manualmente se precisa remover algo"
else
    echo "✅ Pasta $SOURCE_DIR removida"
fi

echo ""
echo "=============================================="
echo "✅ Concluído!"
echo "=============================================="
