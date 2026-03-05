#!/bin/bash

# Script de setup e gerenciamento do Ollama
# Facilita o download e gerenciamento de modelos LLM

set -e

OLLAMA_HOST="http://localhost:11434"

echo "🦙 Ollama Setup & Management"
echo "=============================="
echo ""

# Função para verificar se o Ollama está rodando
check_ollama() {
    if curl -s "$OLLAMA_HOST" > /dev/null 2>&1; then
        echo "✅ Ollama está rodando"
        return 0
    else
        echo "❌ Ollama não está rodando"
        echo "💡 Execute: docker-compose up -d ollama"
        return 1
    fi
}

# Função para listar modelos instalados
list_models() {
    echo "📦 Modelos instalados:"
    echo ""
    docker exec ollama ollama list
}

# Função para baixar um modelo
pull_model() {
    local model=$1
    echo "⬇️  Baixando modelo: $model"
    echo "⏳ Isso pode levar alguns minutos..."
    docker exec -it ollama ollama pull "$model"
    echo "✅ Modelo $model baixado com sucesso!"
}

# Função para remover um modelo
remove_model() {
    local model=$1
    echo "🗑️  Removendo modelo: $model"
    docker exec ollama ollama rm "$model"
    echo "✅ Modelo $model removido!"
}

# Função para testar um modelo
test_model() {
    local model=$1
    echo "🧪 Testando modelo: $model"
    echo ""
    docker exec -it ollama ollama run "$model" "Olá! Me diga em uma frase o que você pode fazer."
}

# Menu principal
show_menu() {
    echo ""
    echo "Escolha uma opção:"
    echo "1) Verificar status do Ollama"
    echo "2) Listar modelos instalados"
    echo "3) Baixar modelo recomendado (llama3.2:3b)"
    echo "4) Baixar modelo personalizado"
    echo "5) Testar modelo"
    echo "6) Remover modelo"
    echo "7) Ver modelos disponíveis populares"
    echo "0) Sair"
    echo ""
    read -p "Opção: " choice
    
    case $choice in
        1)
            check_ollama
            ;;
        2)
            list_models
            ;;
        3)
            pull_model "llama3.2:3b"
            ;;
        4)
            read -p "Nome do modelo (ex: llama3.2:3b, mistral, codellama): " model
            pull_model "$model"
            ;;
        5)
            read -p "Nome do modelo para testar: " model
            test_model "$model"
            ;;
        6)
            read -p "Nome do modelo para remover: " model
            remove_model "$model"
            ;;
        7)
            show_popular_models
            ;;
        0)
            echo "👋 Até logo!"
            exit 0
            ;;
        *)
            echo "❌ Opção inválida"
            ;;
    esac
}

# Mostra modelos populares
show_popular_models() {
    echo ""
    echo "📚 Modelos LLM Populares:"
    echo ""
    echo "🔹 Uso Geral:"
    echo "   - llama3.2:3b      (3GB)  - Rápido, bom para tarefas gerais"
    echo "   - llama3.2:1b      (1GB)  - Muito rápido, leve"
    echo "   - llama3.1:8b      (4.7GB) - Mais poderoso"
    echo "   - mistral:7b       (4GB)  - Excelente performance"
    echo ""
    echo "🔹 Código:"
    echo "   - codellama:7b     (4GB)  - Especializado em programação"
    echo "   - deepseek-coder:6.7b (3.8GB) - Ótimo para código"
    echo ""
    echo "🔹 Português:"
    echo "   - sabia-2-small    (3GB)  - Treinado em português"
    echo ""
    echo "🔹 Multilíngue:"
    echo "   - aya:8b           (4.8GB) - 101 idiomas"
    echo ""
    echo "💡 Recomendação para começar: llama3.2:3b"
    echo ""
}

# Verifica se foi passado argumento
if [ $# -eq 0 ]; then
    # Modo interativo
    check_ollama
    while true; do
        show_menu
    done
else
    # Modo comando único
    case $1 in
        status)
            check_ollama
            ;;
        list)
            list_models
            ;;
        pull)
            if [ -z "$2" ]; then
                echo "❌ Uso: $0 pull <modelo>"
                exit 1
            fi
            pull_model "$2"
            ;;
        rm)
            if [ -z "$2" ]; then
                echo "❌ Uso: $0 rm <modelo>"
                exit 1
            fi
            remove_model "$2"
            ;;
        test)
            if [ -z "$2" ]; then
                echo "❌ Uso: $0 test <modelo>"
                exit 1
            fi
            test_model "$2"
            ;;
        *)
            echo "❌ Comando inválido: $1"
            echo ""
            echo "Uso: $0 [comando] [argumentos]"
            echo ""
            echo "Comandos:"
            echo "  status          - Verifica se Ollama está rodando"
            echo "  list            - Lista modelos instalados"
            echo "  pull <modelo>   - Baixa um modelo"
            echo "  rm <modelo>     - Remove um modelo"
            echo "  test <modelo>   - Testa um modelo"
            echo ""
            echo "Ou execute sem argumentos para modo interativo."
            exit 1
            ;;
    esac
fi
