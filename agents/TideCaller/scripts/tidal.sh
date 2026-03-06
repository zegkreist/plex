#!/bin/bash

# ============================================
# Tidal Helper Script para Streamrip
# ============================================
# Script auxiliar com funções para facilitar
# downloads de álbuns e playlists do Tidal
# ============================================

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Define UID e GID do usuário atual para evitar problemas de permissão
export USER_ID=$(id -u)
export GROUP_ID=$(id -g)

# Função base para executar streamrip
rip_cmd() {
    docker-compose run --rm streamrip "$@"
}

# ============================================
# FUNÇÕES DE DOWNLOAD
# ============================================

# Download de álbum do Tidal por URL
tidal_album() {
    local url="$1"
    local quality="${2:-3}"  # Qualidade padrão: 3 (24bit MQA)
    
    if [ -z "$url" ]; then
        echo -e "${RED}❌ Erro: URL do álbum é obrigatória${NC}"
        echo "Uso: tidal_album <URL> [qualidade]"
        echo "Exemplo: tidal_album https://tidal.com/browse/album/123456 3"
        return 1
    fi
    
    echo -e "${BLUE}🎵 Baixando álbum do Tidal...${NC}"
    echo -e "${CYAN}URL:${NC} $url"
    echo -e "${CYAN}Qualidade:${NC} $quality"
    echo ""
    
    rip_cmd -q "$quality" url "$url"
}

# Download de playlist do Tidal por URL
tidal_playlist() {
    local url="$1"
    local quality="${2:-3}"
    
    if [ -z "$url" ]; then
        echo -e "${RED}❌ Erro: URL da playlist é obrigatória${NC}"
        echo "Uso: tidal_playlist <URL> [qualidade]"
        echo "Exemplo: tidal_playlist https://tidal.com/browse/playlist/uuid 3"
        return 1
    fi
    
    echo -e "${BLUE}📋 Baixando playlist do Tidal...${NC}"
    echo -e "${CYAN}URL:${NC} $url"
    echo -e "${CYAN}Qualidade:${NC} $quality"
    echo ""
    
    rip_cmd -q "$quality" url "$url"
}

# Download de track do Tidal por URL
tidal_track() {
    local url="$1"
    local quality="${2:-3}"
    
    if [ -z "$url" ]; then
        echo -e "${RED}❌ Erro: URL da track é obrigatória${NC}"
        echo "Uso: tidal_track <URL> [qualidade]"
        echo "Exemplo: tidal_track https://tidal.com/browse/track/123456 3"
        return 1
    fi
    
    echo -e "${BLUE}🎵 Baixando track do Tidal...${NC}"
    echo -e "${CYAN}URL:${NC} $url"
    echo -e "${CYAN}Qualidade:${NC} $quality"
    echo ""
    
    rip_cmd -q "$quality" url "$url"
}

# Download de discografia de artista
tidal_artist() {
    local url="$1"
    local quality="${2:-3}"
    
    if [ -z "$url" ]; then
        echo -e "${RED}❌ Erro: URL do artista é obrigatória${NC}"
        echo "Uso: tidal_artist <URL> [qualidade]"
        echo "Exemplo: tidal_artist https://tidal.com/browse/artist/123456 3"
        return 1
    fi
    
    echo -e "${BLUE}👤 Baixando discografia do artista...${NC}"
    echo -e "${CYAN}URL:${NC} $url"
    echo -e "${CYAN}Qualidade:${NC} $quality"
    echo ""
    
    rip_cmd -q "$quality" url "$url"
}

# Download por ID do Tidal
tidal_id() {
    local type="$1"  # album, track, playlist, artist
    local id="$2"
    local quality="${3:-3}"
    
    if [ -z "$type" ] || [ -z "$id" ]; then
        echo -e "${RED}❌ Erro: Tipo e ID são obrigatórios${NC}"
        echo "Uso: tidal_id <tipo> <id> [qualidade]"
        echo "Tipos: album, track, playlist, artist"
        echo "Exemplo: tidal_id album 123456789 3"
        return 1
    fi
    
    echo -e "${BLUE}🆔 Baixando por ID do Tidal...${NC}"
    echo -e "${CYAN}Tipo:${NC} $type"
    echo -e "${CYAN}ID:${NC} $id"
    echo -e "${CYAN}Qualidade:${NC} $quality"
    echo ""
    
    rip_cmd -q "$quality" id tidal "$type" "$id"
}

# ============================================
# FUNÇÕES DE BUSCA
# ============================================

# Buscar álbum no Tidal
tidal_search_album() {
    local query="$1"
    local download_first="${2:-false}"
    
    if [ -z "$query" ]; then
        echo -e "${RED}❌ Erro: Query de busca é obrigatória${NC}"
        echo "Uso: tidal_search_album <busca> [auto]"
        echo "Exemplo: tidal_search_album 'daft punk discovery'"
        echo "         tidal_search_album 'daft punk discovery' auto  # Baixa o primeiro resultado"
        return 1
    fi
    
    echo -e "${BLUE}🔍 Buscando álbum no Tidal...${NC}"
    echo -e "${CYAN}Busca:${NC} $query"
    echo ""
    
    if [ "$download_first" = "auto" ]; then
        rip_cmd search tidal album "$query" -f
    else
        rip_cmd search tidal album "$query"
    fi
}

# Buscar playlist no Tidal
tidal_search_playlist() {
    local query="$1"
    local download_first="${2:-false}"
    
    if [ -z "$query" ]; then
        echo -e "${RED}❌ Erro: Query de busca é obrigatória${NC}"
        echo "Uso: tidal_search_playlist <busca> [auto]"
        echo "Exemplo: tidal_search_playlist 'rock classics'"
        return 1
    fi
    
    echo -e "${BLUE}🔍 Buscando playlist no Tidal...${NC}"
    echo -e "${CYAN}Busca:${NC} $query"
    echo ""
    
    if [ "$download_first" = "auto" ]; then
        rip_cmd search tidal playlist "$query" -f
    else
        rip_cmd search tidal playlist "$query"
    fi
}

# Buscar artista no Tidal
tidal_search_artist() {
    local query="$1"
    local download_first="${2:-false}"
    
    if [ -z "$query" ]; then
        echo -e "${RED}❌ Erro: Query de busca é obrigatória${NC}"
        echo "Uso: tidal_search_artist <busca> [auto]"
        echo "Exemplo: tidal_search_artist 'pink floyd'"
        return 1
    fi
    
    echo -e "${BLUE}🔍 Buscando artista no Tidal...${NC}"
    echo -e "${CYAN}Busca:${NC} $query"
    echo ""
    
    if [ "$download_first" = "auto" ]; then
        rip_cmd search tidal artist "$query" -f
    else
        rip_cmd search tidal artist "$query"
    fi
}

# Buscar track no Tidal
tidal_search_track() {
    local query="$1"
    local download_first="${2:-false}"
    
    if [ -z "$query" ]; then
        echo -e "${RED}❌ Erro: Query de busca é obrigatória${NC}"
        echo "Uso: tidal_search_track <busca> [auto]"
        echo "Exemplo: tidal_search_track 'bohemian rhapsody'"
        return 1
    fi
    
    echo -e "${BLUE}🔍 Buscando track no Tidal...${NC}"
    echo -e "${CYAN}Busca:${NC} $query"
    echo ""
    
    if [ "$download_first" = "auto" ]; then
        rip_cmd search tidal track "$query" -f
    else
        rip_cmd search tidal track "$query"
    fi
}

# ============================================
# FUNÇÕES DE CONVERSÃO
# ============================================

# Download e conversão para MP3
tidal_album_mp3() {
    local url="$1"
    local quality="${2:-1}"  # Qualidade 1 para MP3 320kbps
    
    if [ -z "$url" ]; then
        echo -e "${RED}❌ Erro: URL é obrigatória${NC}"
        return 1
    fi
    
    echo -e "${BLUE}🎵 Baixando e convertendo para MP3...${NC}"
    rip_cmd -q "$quality" -c MP3 url "$url"
}

# Download e conversão para FLAC
tidal_album_flac() {
    local url="$1"
    local quality="${2:-2}"  # Qualidade 2 para FLAC CD
    
    if [ -z "$url" ]; then
        echo -e "${RED}❌ Erro: URL é obrigatória${NC}"
        return 1
    fi
    
    echo -e "${BLUE}🎵 Baixando em FLAC...${NC}"
    rip_cmd -q "$quality" -c FLAC url "$url"
}

# ============================================
# FUNÇÕES DE UTILIDADE
# ============================================

# Mostrar histórico de downloads
tidal_history() {
    echo -e "${BLUE}📊 Histórico de downloads${NC}"
    echo ""
    rip_cmd database browse downloads
}

# Mostrar downloads que falharam
tidal_failed() {
    echo -e "${BLUE}❌ Downloads que falharam${NC}"
    echo ""
    rip_cmd database browse failed
}

# Mostrar informações de qualidade
tidal_quality_info() {
    echo -e "${CYAN}═══════════════════════════════════════════${NC}"
    echo -e "${YELLOW}    Níveis de Qualidade - Tidal${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════${NC}"
    echo ""
    echo -e "${GREEN}0${NC} - 256 kbps AAC (Normal)"
    echo -e "${GREEN}1${NC} - 320 kbps AAC (High)"
    echo -e "${GREEN}2${NC} - 16 bit, 44.1 kHz FLAC (HiFi - qualidade CD)"
    echo -e "${GREEN}3${NC} - 24 bit, 44.1 kHz FLAC (MQA - Master Quality)"
    echo ""
    echo -e "${YELLOW}Nota:${NC} Você precisa de assinatura Tidal HiFi para qualidades 2 e 3"
    echo ""
}

# Abrir configuração
tidal_config() {
    echo -e "${BLUE}⚙️  Abrindo configuração do streamrip...${NC}"
    rip_cmd config open
}

# ============================================
# MENU INTERATIVO
# ============================================

show_menu() {
    clear
    echo -e "${CYAN}═══════════════════════════════════════════${NC}"
    echo -e "${YELLOW}    Tidal Downloader - Menu Interativo${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════${NC}"
    echo ""
    echo -e "${GREEN}Downloads por URL:${NC}"
    echo "  1) Baixar álbum"
    echo "  2) Baixar playlist"
    echo "  3) Baixar track"
    echo "  4) Baixar discografia de artista"
    echo ""
    echo -e "${GREEN}Busca e Download:${NC}"
    echo "  5) Buscar álbum"
    echo "  6) Buscar playlist"
    echo "  7) Buscar artista"
    echo "  8) Buscar track"
    echo ""
    echo -e "${GREEN}Utilitários:${NC}"
    echo "  9) Ver histórico de downloads"
    echo " 10) Ver downloads que falharam"
    echo " 11) Informações de qualidade"
    echo " 12) Abrir configuração"
    echo ""
    echo "  0) Sair"
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════${NC}"
}

interactive_menu() {
    while true; do
        show_menu
        read -p "Escolha uma opção: " choice
        echo ""
        
        case $choice in
            1)
                read -p "URL do álbum: " url
                read -p "Qualidade (0-3, default 3): " quality
                quality=${quality:-3}
                tidal_album "$url" "$quality"
                read -p "Pressione Enter para continuar..."
                ;;
            2)
                read -p "URL da playlist: " url
                read -p "Qualidade (0-3, default 3): " quality
                quality=${quality:-3}
                tidal_playlist "$url" "$quality"
                read -p "Pressione Enter para continuar..."
                ;;
            3)
                read -p "URL da track: " url
                read -p "Qualidade (0-3, default 3): " quality
                quality=${quality:-3}
                tidal_track "$url" "$quality"
                read -p "Pressione Enter para continuar..."
                ;;
            4)
                read -p "URL do artista: " url
                read -p "Qualidade (0-3, default 3): " quality
                quality=${quality:-3}
                tidal_artist "$url" "$quality"
                read -p "Pressione Enter para continuar..."
                ;;
            5)
                read -p "Buscar álbum: " query
                tidal_search_album "$query"
                read -p "Pressione Enter para continuar..."
                ;;
            6)
                read -p "Buscar playlist: " query
                tidal_search_playlist "$query"
                read -p "Pressione Enter para continuar..."
                ;;
            7)
                read -p "Buscar artista: " query
                tidal_search_artist "$query"
                read -p "Pressione Enter para continuar..."
                ;;
            8)
                read -p "Buscar track: " query
                tidal_search_track "$query"
                read -p "Pressione Enter para continuar..."
                ;;
            9)
                tidal_history
                read -p "Pressione Enter para continuar..."
                ;;
            10)
                tidal_failed
                read -p "Pressione Enter para continuar..."
                ;;
            11)
                tidal_quality_info
                read -p "Pressione Enter para continuar..."
                ;;
            12)
                tidal_config
                read -p "Pressione Enter para continuar..."
                ;;
            0)
                echo -e "${GREEN}👋 Até logo!${NC}"
                exit 0
                ;;
            *)
                echo -e "${RED}❌ Opção inválida!${NC}"
                read -p "Pressione Enter para continuar..."
                ;;
        esac
    done
}

# ============================================
# AJUDA
# ============================================

show_help() {
    echo -e "${CYAN}═══════════════════════════════════════════${NC}"
    echo -e "${YELLOW}    Tidal Helper - Ajuda${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════${NC}"
    echo ""
    echo -e "${GREEN}Uso:${NC}"
    echo "  source tidal.sh          # Carregar funções"
    echo "  ./tidal.sh menu          # Menu interativo"
    echo "  ./tidal.sh help          # Esta ajuda"
    echo ""
    echo -e "${GREEN}Funções disponíveis:${NC}"
    echo ""
    echo -e "${YELLOW}Downloads:${NC}"
    echo "  tidal_album <url> [qualidade]"
    echo "  tidal_playlist <url> [qualidade]"
    echo "  tidal_track <url> [qualidade]"
    echo "  tidal_artist <url> [qualidade]"
    echo "  tidal_id <tipo> <id> [qualidade]"
    echo ""
    echo -e "${YELLOW}Busca:${NC}"
    echo "  tidal_search_album <busca> [auto]"
    echo "  tidal_search_playlist <busca> [auto]"
    echo "  tidal_search_artist <busca> [auto]"
    echo "  tidal_search_track <busca> [auto]"
    echo ""
    echo -e "${YELLOW}Conversão:${NC}"
    echo "  tidal_album_mp3 <url> [qualidade]"
    echo "  tidal_album_flac <url> [qualidade]"
    echo ""
    echo -e "${YELLOW}Utilitários:${NC}"
    echo "  tidal_history          # Ver histórico"
    echo "  tidal_failed           # Ver falhas"
    echo "  tidal_quality_info     # Info de qualidade"
    echo "  tidal_config           # Abrir config"
    echo ""
    echo -e "${GREEN}Exemplos:${NC}"
    echo "  tidal_album https://tidal.com/browse/album/123456 3"
    echo "  tidal_search_album 'daft punk discovery'"
    echo "  tidal_search_album 'thriller' auto  # Baixa primeiro resultado"
    echo "  tidal_id album 123456789 2"
    echo ""
    echo -e "${YELLOW}Qualidades:${NC} 0 (256kbps) | 1 (320kbps) | 2 (HiFi) | 3 (MQA)"
    echo ""
}

# ============================================
# MAIN
# ============================================

# Se executado diretamente (não via source)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-help}" in
        menu)
            interactive_menu
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            show_help
            ;;
    esac
fi
