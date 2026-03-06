# 🎵 Tidal Helper Script - Guia de Uso

Script auxiliar com funções para facilitar downloads do Tidal usando streamrip no Docker.

## 🚀 Modos de Uso

### 1. Menu Interativo (Recomendado para iniciantes)

```bash
./tidal.sh menu
```

Abre um menu interativo com todas as opções disponíveis.

### 2. Funções no Terminal (Para usuários avançados)

```bash
source tidal.sh  # Carrega as funções no terminal atual
```

Depois você pode usar qualquer função diretamente.

## 📚 Funções Disponíveis

### 🎵 Downloads por URL

#### Baixar Álbum

```bash
tidal_album <url> [qualidade]
```

**Exemplos:**

```bash
# Qualidade máxima (MQA)
tidal_album "https://tidal.com/browse/album/123456" 3

# Qualidade HiFi (CD)
tidal_album "https://tidal.com/browse/album/123456" 2

# Qualidade padrão (usa 3 se não especificado)
tidal_album "https://tidal.com/browse/album/123456"
```

#### Baixar Playlist

```bash
tidal_playlist <url> [qualidade]
```

**Exemplos:**

```bash
tidal_playlist "https://tidal.com/browse/playlist/uuid-da-playlist" 3
tidal_playlist "https://tidal.com/browse/playlist/uuid-da-playlist"  # Usa qualidade 3
```

#### Baixar Track

```bash
tidal_track <url> [qualidade]
```

**Exemplos:**

```bash
tidal_track "https://tidal.com/browse/track/123456" 2
```

#### Baixar Discografia Completa

```bash
tidal_artist <url> [qualidade]
```

**Exemplos:**

```bash
tidal_artist "https://tidal.com/browse/artist/123456" 3
```

#### Download por ID

```bash
tidal_id <tipo> <id> [qualidade]
```

**Tipos:** `album`, `track`, `playlist`, `artist`

**Exemplos:**

```bash
tidal_id album 123456789 3
tidal_id playlist uuid-da-playlist 2
tidal_id track 987654321 3
tidal_id artist 555444333 2
```

### 🔍 Funções de Busca

#### Buscar Álbum

```bash
tidal_search_album <busca> [auto]
```

**Exemplos:**

```bash
# Busca interativa (escolhe na lista)
tidal_search_album "daft punk discovery"

# Busca e baixa automaticamente o primeiro resultado
tidal_search_album "daft punk discovery" auto

# Busca com múltiplas palavras
tidal_search_album "pink floyd dark side of the moon"
```

#### Buscar Playlist

```bash
tidal_search_playlist <busca> [auto]
```

**Exemplos:**

```bash
tidal_search_playlist "rock classics"
tidal_search_playlist "chill vibes" auto
```

#### Buscar Artista

```bash
tidal_search_artist <busca> [auto]
```

**Exemplos:**

```bash
tidal_search_artist "the beatles"
tidal_search_artist "metallica" auto
```

#### Buscar Track

```bash
tidal_search_track <busca> [auto]
```

**Exemplos:**

```bash
tidal_search_track "bohemian rhapsody"
tidal_search_track "stairway to heaven" auto
```

### 🔄 Funções de Conversão

#### Baixar e Converter para MP3

```bash
tidal_album_mp3 <url> [qualidade]
```

**Exemplos:**

```bash
# MP3 320kbps (qualidade 1)
tidal_album_mp3 "https://tidal.com/browse/album/123456"

# MP3 com qualidade específica
tidal_album_mp3 "https://tidal.com/browse/album/123456" 1
```

#### Baixar em FLAC

```bash
tidal_album_flac <url> [qualidade]
```

**Exemplos:**

```bash
# FLAC qualidade CD (qualidade 2)
tidal_album_flac "https://tidal.com/browse/album/123456"

# FLAC MQA (qualidade 3)
tidal_album_flac "https://tidal.com/browse/album/123456" 3
```

### 🛠️ Funções Utilitárias

#### Ver Histórico de Downloads

```bash
tidal_history
```

#### Ver Downloads que Falharam

```bash
tidal_failed
```

#### Informações sobre Qualidade

```bash
tidal_quality_info
```

Mostra:

```
═══════════════════════════════════════════
    Níveis de Qualidade - Tidal
═══════════════════════════════════════════

0 - 256 kbps AAC (Normal)
1 - 320 kbps AAC (High)
2 - 16 bit, 44.1 kHz FLAC (HiFi - qualidade CD)
3 - 24 bit, 44.1 kHz FLAC (MQA - Master Quality)

Nota: Você precisa de assinatura Tidal HiFi para qualidades 2 e 3
```

#### Abrir Configuração

```bash
tidal_config
```

## 📊 Tabela de Qualidades

| Nível | Formato | Qualidade           | Assinatura Necessária |
| ----- | ------- | ------------------- | --------------------- |
| 0     | AAC     | 256 kbps            | Normal                |
| 1     | AAC     | 320 kbps            | Normal                |
| 2     | FLAC    | 16bit/44.1kHz (CD)  | HiFi                  |
| 3     | FLAC    | 24bit/44.1kHz (MQA) | HiFi                  |

## 💡 Exemplos de Uso Completo

### Cenário 1: Baixar álbum específico em alta qualidade

```bash
source tidal.sh
tidal_album "https://tidal.com/browse/album/147569387" 3
```

### Cenário 2: Buscar e baixar automaticamente

```bash
source tidal.sh
tidal_search_album "thriller michael jackson" auto
```

### Cenário 3: Baixar playlist em MP3 para dispositivo móvel

```bash
source tidal.sh
tidal_album_mp3 "https://tidal.com/browse/playlist/uuid-aqui" 1
```

### Cenário 4: Baixar discografia completa de um artista

```bash
source tidal.sh
tidal_artist "https://tidal.com/browse/artist/123456" 2
```

### Cenário 5: Usar o menu interativo

```bash
./tidal.sh menu
# Escolha a opção desejada no menu
```

## 🔧 Workflow Recomendado

### Para Iniciantes:

1. Execute `./tidal.sh menu`
2. Escolha a opção desejada
3. Siga as instruções na tela

### Para Usuários Avançados:

1. Adicione ao seu `.bashrc` ou `.zshrc`:

   ```bash
   alias tidal='source ~/caminho/para/tidal.sh'
   ```

2. Use em qualquer terminal:
   ```bash
   tidal
   tidal_album "url" 3
   tidal_search_album "busca"
   ```

## 📝 Dicas

1. **URLs com espaços ou caracteres especiais**: Use aspas

   ```bash
   tidal_album "https://tidal.com/browse/album/123456"
   ```

2. **Buscar múltiplas palavras**: Use aspas

   ```bash
   tidal_search_album "dark side of the moon"
   ```

3. **Download em lote**: Crie um script bash

   ```bash
   #!/bin/bash
   source tidal.sh

   tidal_album "url1" 3
   tidal_album "url2" 3
   tidal_playlist "url3" 2
   ```

4. **Ver progresso**: O script usa o streamrip que mostra barras de progresso automaticamente

5. **Cancelar download**: Pressione `Ctrl+C`

## 🚨 Troubleshooting

### Função não encontrada

```bash
# Certifique-se de carregar o script com source
source tidal.sh

# OU execute o menu
./tidal.sh menu
```

### Erro de autenticação

```bash
# Verifique suas credenciais
tidal_config

# Ou reconfigure o Tidal
./setup_tidal.sh
```

### Download não inicia

```bash
# Verifique se o Docker está rodando
docker ps

# Reconstrua a imagem
docker-compose build
```

## 📖 Ajuda

Para ver a ajuda rápida:

```bash
./tidal.sh help
```

Para ver este guia completo:

```bash
cat TIDAL_GUIDE.md
```

## 🔗 Links Úteis

- [Streamrip Wiki](https://github.com/nathom/streamrip/wiki)
- [Command Line Reference](https://github.com/nathom/streamrip/wiki/Command-Line-Reference)
- [README principal](readme.md)
- [Guia de Configuração](CONFIG_GUIDE.md)
- [Referência Rápida](QUICK_REFERENCE.md)

## ⚠️ Notas Importantes

1. **Assinatura Tidal**: Você precisa de uma conta Tidal HiFi ativa
2. **Tokens expiram**: Os tokens expiram após 7 dias de inatividade
3. **Rate limiting**: O Tidal limita o número de downloads simultâneos
4. **Espaço em disco**: Downloads em alta qualidade ocupam muito espaço
5. **Docker**: Certifique-se de que o Docker está rodando

## 🎯 Atalhos Rápidos

```bash
# Abrir menu
./tidal.sh menu

# Carregar funções
source tidal.sh

# Download rápido
tidal_album "URL" 3

# Busca rápida
tidal_search_album "termo de busca"

# Ver ajuda
./tidal.sh help
```
