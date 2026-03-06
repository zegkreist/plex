#!/bin/bash

# Script para corrigir permissões das pastas config e downloads
# Útil quando os arquivos foram criados como root

echo "=============================================="
echo "  Correção de Permissões - Streamrip"
echo "=============================================="
echo ""

# Obter UID e GID do usuário atual
USER_ID=$(id -u)
GROUP_ID=$(id -g)

echo "📝 Informações do usuário:"
echo "   UID: $USER_ID"
echo "   GID: $GROUP_ID"
echo "   Usuário: $USER"
echo ""

# Verificar se as pastas existem
if [ -d "config" ] || [ -d "downloads" ]; then
    echo "🔍 Verificando permissões atuais..."
    echo ""
    
    if [ -d "config" ]; then
        echo "📂 config/"
        ls -la config/ | head -5
        echo ""
    fi
    
    if [ -d "downloads" ]; then
        echo "📂 downloads/"
        ls -la downloads/ | head -5
        echo ""
    fi
    
    echo "⚠️  Corrigindo permissões..."
    echo "   Isso pode levar alguns segundos..."
    echo ""
    
    # Corrigir permissões
    [ -d "config" ] && sudo chown -R $USER_ID:$GROUP_ID config/
    [ -d "downloads" ] && sudo chown -R $USER_ID:$GROUP_ID downloads/
    
    # Garantir permissões de leitura/escrita
    [ -d "config" ] && chmod -R u+rwX,g+rX,o+rX config/
    [ -d "downloads" ] && chmod -R u+rwX,g+rX,o+rX downloads/
    
    echo "✅ Permissões corrigidas!"
    echo ""
    
    echo "📊 Permissões após correção:"
    echo ""
    
    if [ -d "config" ]; then
        echo "📂 config/"
        ls -la config/ | head -5
        echo ""
    fi
    
    if [ -d "downloads" ]; then
        echo "📂 downloads/"
        ls -la downloads/ | head -5
        echo ""
    fi
else
    echo "ℹ️  As pastas config e downloads ainda não existem."
    echo "   Elas serão criadas automaticamente ao executar o streamrip."
    echo ""
fi

echo "=============================================="
echo "✅ Concluído!"
echo "=============================================="
echo ""
echo "💡 Dica: Se você encontrar problemas de permissão no futuro,"
echo "   execute este script novamente:"
echo "   ./fix_permissions.sh"
echo ""
