# 🎵 Streamrip Docker

Configuração Docker para executar o [streamrip](https://github.com/nathom/streamrip) - um downloader de música para Qobuz, Tidal, Deezer e SoundCloud.

---

## 📋 Índice

1. [Pré-requisitos](#-pré-requisitos)
2. [Setup Inicial](#-setup-inicial)
3. [Configurar Tidal](#-configurar-tidal)
4. [Como Usar - Básico (rip.sh)](#-como-usar---básico-ripsh)
5. [Como Usar - Tidal Helper (tidal.sh)](#-como-usar---tidal-helper-tidalsh)
6. [Estrutura do Projeto](#-estrutura-do-projeto)
7. [Troubleshooting](#-troubleshooting)
8. [Documentação Adicional](#-documentação-adicional)

---

## 🔧 Pré-requisitos

Antes de começar, você precisa apenas de:

### 1. Docker e Docker Compose instalados

#### Ubuntu/Debian:

```bash
# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Adicionar seu usuário ao grupo docker (não precisar de sudo)
sudo usermod -aG docker $USER

# IMPORTANTE: Faça logout/login ou reinicie o sistema
```

#### Verificar se está instalado:

```bash
docker --version
docker-compose --version
```

**Saída esperada:**

```
Docker version 24.x.x
Docker Compose version 2.x.x
```

### 2. Assinatura de Streaming (escolha uma)

- **Tidal HiFi** - Recomendado para MQA (24-bit)
- **Qobuz** - Melhor qualidade Hi-Res (até 192kHz)
- **Deezer Premium** - Alternativa em FLAC
- **SoundCloud** - Grátis (qualidade limitada)

**Nota:** Tudo mais (streamrip, ffmpeg, etc) já está incluído no Docker! 🎉

---

## 🚀 Setup Inicial (3 passos simples)

### Passo 1: Executar script de instalação

```bash
./setup/install_streamrip.sh
```

**O que este script faz:**

- ✅ Verifica se Docker está instalado
- ✅ Constrói a imagem Docker com streamrip
- ✅ Configura permissões corretas
- ✅ Prepara tudo para uso

⏱️ **Tempo:** 3-5 minutos

### Passo 2: Criar arquivo de configuração

```bash
./scripts/rip.sh config open
```

Este comando cria o arquivo `config/.config/streamrip/config.toml` automaticamente.

**⚠️ IMPORTANTE - Verificar caminho de downloads:**

```bash
grep "^folder = " config/.config/streamrip/config.toml
```

**Deve mostrar:** `folder = "/downloads"`

Se estiver diferente (ex: `/config/StreamripDownloads`), edite:

```bash
nano config/.config/streamrip/config.toml
# Altere para: folder = "/downloads"
```

---

### Passo 3: Configurar Tidal

Execute o script de configuração do Tidal:

```bash
./setup/setup_tidal.sh
```

**O que acontece:**

1. Script cria ambiente Python virtual
2. Instala `tidalapi` automaticamente
3. Gera link e código de autenticação
4. Aguarda você autorizar no navegador

**Exemplo de saída:**

```
🔐 Iniciando processo de autenticação...

📋 Instruções:
1. Abra: link.tidal.com/XKPKB
2. Faça login com sua conta Tidal HiFi
3. Autorize o acesso

⏳ Aguardando autorização...
✅ Tokens salvos em: tidal_tokens.txt
```

**Agora edite o config e cole os tokens:**

```bash
# Ver os tokens gerados
cat tidal_tokens.txt

# Editar o config
nano config/.config/streamrip/config.toml
```

Na seção `[tidal]`, substitua pelos valores do arquivo `tidal_tokens.txt`.

**✅ Setup completo! Agora você pode baixar músicas.**

**⏰ Nota:** Tokens expiram após 7 dias. Se necessário, execute `./setup/setup_tidal.sh` novamente.

---

## 💿 Como Usar - Scripts de Download

### Opção 1: rip.sh (download direto via streamrip)

#### Download por URL

```bash
# Baixar álbum
./scripts/rip.sh url https://tidal.com/browse/album/123456789

# Baixar playlist
./scripts/rip.sh url https://tidal.com/browse/playlist/uuid-da-playlist

# Múltiplas URLs
./scripts/rip.sh url https://tidal.com/album/1 https://tidal.com/album/2
```

#### Buscar e baixar

```bash
# Buscar álbum (modo interativo)
./scripts/rip.sh search tidal album "daft punk discovery"

# Buscar e baixar primeiro resultado automaticamente
./scripts/rip.sh search tidal album "pink floyd" -f

# Buscar artista
./scripts/rip.sh search tidal artist "radiohead"

# Buscar playlist
./scripts/rip.sh search tidal playlist "rock classics"
```

#### 3. Definir qualidade

```bash
# Qualidade 3 = MQA (24-bit) - Padrão para Tidal
./scripts/rip.sh -q 3 url <URL>

# Qualidade 2 = HiFi (16-bit, CD quality)
./scripts/rip.sh -q 2 url <URL>

# Qualidade 1 = 320kbps AAC
./scripts/rip.sh -q 1 url <URL>
```

**Tabela de qualidades:**
| Nível | Formato | Qualidade | Requer |
|-------|---------|-----------|--------|
| 0 | AAC | 256 kbps | Tidal Normal |
| 1 | AAC | 320 kbps | Tidal Normal |
| 2 | FLAC | 16-bit, 44.1kHz (CD) | Tidal HiFi |
| 3 | FLAC | 24-bit, 44.1kHz (MQA) | Tidal HiFi |

#### 4. Converter formato

```bash
# Baixar e converter para MP3
./scripts/rip.sh -c MP3 url <URL>

# Baixar em qualidade 1 e converter para AAC
./scripts/rip.sh -q 1 -c AAC url <URL>

# Manter em FLAC
./scripts/rip.sh -c FLAC url <URL>
```

#### 5. Comandos úteis

```bash
# Ver ajuda
./scripts/rip.sh --help

# Ver versão
./scripts/rip.sh --version

# Abrir configuração
./scripts/rip.sh config open

# Ver caminho do config
./scripts/rip.sh config path

# Ver histórico de downloads
./scripts/rip.sh database browse downloads
```

---

## 🎯 Como Usar - Tidal Helper (tidal.sh)

O `tidal.sh` é um script especializado para Tidal com funções prontas e menu interativo.

### Modo 1: Menu Interativo (Recomendado para iniciantes)

```bash
./scripts/tidal.sh menu
```

**O que aparece:**

```
═══════════════════════════════════════════
    Tidal Downloader - Menu Interativo
═══════════════════════════════════════════

Downloads por URL:
  1) Baixar álbum
  2) Baixar playlist
  3) Baixar track
  4) Baixar discografia de artista

Busca e Download:
  5) Buscar álbum
  6) Buscar playlist
  7) Buscar artista
  8) Buscar track

Utilitários:
  9) Ver histórico de downloads
 10) Ver downloads que falharam
 11) Informações de qualidade
 12) Abrir configuração

  0) Sair

═══════════════════════════════════════════
Escolha uma opção:
```

Basta digitar o número e seguir as instruções!

### Modo 2: Funções Diretas (Para usuários avançados)

Primeiro, carregue as funções:

```bash
source scripts/tidal.sh
```

Agora você tem acesso a várias funções:

#### Download por URL:

```bash
# Baixar álbum em qualidade máxima (MQA)
tidal_album "https://tidal.com/browse/album/123456" 3

# Baixar playlist
tidal_playlist "https://tidal.com/browse/playlist/uuid" 3

# Baixar track única
tidal_track "https://tidal.com/browse/track/123456" 2

# Baixar discografia completa de artista
tidal_artist "https://tidal.com/browse/artist/123456" 3

# Download por ID
tidal_id album 123456789 3
```

#### Buscar:

```bash
# Buscar álbum (interativo)
tidal_search_album "daft punk discovery"

# Buscar e baixar automaticamente o primeiro resultado
tidal_search_album "thriller" auto

# Buscar playlist
tidal_search_playlist "rock classics"

# Buscar artista
tidal_search_artist "pink floyd"

# Buscar track
tidal_search_track "bohemian rhapsody"
```

#### Conversão:

```bash
# Baixar e converter para MP3 320kbps
tidal_album_mp3 "https://tidal.com/browse/album/123456"

# Baixar em FLAC
tidal_album_flac "https://tidal.com/browse/album/123456" 3
```

#### Utilitários:

```bash
# Ver histórico
tidal_history

# Ver downloads que falharam
tidal_failed

# Informações sobre qualidade
tidal_quality_info

# Abrir configuração
tidal_config
```

### Ver ajuda do tidal.sh:

```bash
./scripts/tidal.sh help
```

---

## 📁 Estrutura do Projeto

```
streamrip/
│
├── 📂 scripts/            # Scripts de execução
│   ├── rip.sh            # Script principal de download
│   └── tidal.sh          # Helper script para Tidal (com menu)
│
├── 📂 setup/              # Scripts de instalação e configuração
│   ├── install_streamrip.sh  # Instalação inicial
│   ├── setup_tidal.sh        # Obter tokens do Tidal
│   ├── get_tidal_tokens.py   # Script Python para tokens
│   ├── fix_permissions.sh    # Corrigir permissões
│   └── move_downloads.sh     # Mover downloads
│
├── 📂 docker/             # Arquivos Docker
│   ├── Dockerfile
│   └── .dockerignore
│
├── 📂 docs/               # Documentação
│   ├── readme.md         # Guia completo
│   ├── TIDAL_GUIDE.md    # Guia do tidal.sh
│   ├── QUICK_REFERENCE.md
│   ├── CONFIG_GUIDE.md
│   └── PERMISSIONS.md
│
├── 📂 examples/           # Exemplos de uso
│   └── examples_tidal.sh
│
├── 📂 config/             # Configurações do streamrip (auto-criado)
├── 📂 downloads/          # Músicas baixadas (auto-criado)
│
├── docker-compose.yml     # Configuração Docker Compose
├── README.md              # Este arquivo
└── .gitignore
```

## 📖 Comandos Principais

### Execução

```bash
# Download básico
./scripts/rip.sh url <URL>

# Menu interativo do Tidal
./scripts/tidal.sh menu

# Usar funções do Tidal
source scripts/tidal.sh
tidal_album "URL" 3
```

### Configuração

```bash
# Abrir configuração
./scripts/rip.sh config open

# Configurar Tidal
./setup/setup_tidal.sh

# Corrigir permissões
./setup/fix_permissions.sh
```

### Manutenção

```bash
# Reconstruir imagem Docker
docker-compose build --no-cache

# Ver logs
docker-compose logs

# Limpar
docker-compose down -v
```

## 📚 Documentação

- **[docs/readme.md](docs/readme.md)** - Documentação completa
- **[docs/TIDAL_GUIDE.md](docs/TIDAL_GUIDE.md)** - Guia do helper do Tidal
- **[docs/QUICK_REFERENCE.md](docs/QUICK_REFERENCE.md)** - Referência rápida
- **[docs/CONFIG_GUIDE.md](docs/CONFIG_GUIDE.md)** - Guia de configuração
- **[docs/PERMISSIONS.md](docs/PERMISSIONS.md)** - Gerenciamento de permissões

## 🔒 Permissões

Este projeto está configurado para criar arquivos com suas permissões (não como root).

Se encontrar problemas de permissão:

```bash
./setup/fix_permissions.sh
```

## ⚡ Exemplos Rápidos

```bash
# Baixar álbum
./scripts/rip.sh url https://tidal.com/browse/album/123456

# Buscar e baixar
./scripts/rip.sh search tidal album "daft punk"

# Menu interativo
./scripts/tidal.sh menu

# Download em MP3
./scripts/rip.sh -c MP3 url <URL>
```

---

## 🛠️ Troubleshooting

### Problema: Downloads vão para pasta errada

**Sintoma:** Arquivos aparecem em `config/StreamripDownloads` ao invés de `downloads/`

**Solução:**

```bash
# 1. Verificar caminho configurado
grep "^folder = " config/.config/streamrip/config.toml
# Deve mostrar: folder = "/downloads"

# 2. Se estiver errado, editar
nano config/.config/streamrip/config.toml
# Altere para: folder = "/downloads"

# 3. Mover arquivos já baixados
./setup/move_downloads.sh
```

### Problema: Arquivos criados como root

**Sintoma:** Não consegue acessar/modificar arquivos em `config/` ou `downloads/`

**Solução:**

```bash
./setup/fix_permissions.sh
```

Este script ajusta todas as permissões para seu usuário.

### Problema: Tokens do Tidal expiraram

**Sintoma:** Erro de autenticação ao tentar baixar

**Solução:**

```bash
./setup/setup_tidal.sh
```

Refaça o processo de autenticação. Tokens expiram após 7 dias de inatividade.

### Problema: Docker não está instalado

**Sintoma:** `docker: command not found`

**Solução:**

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Reiniciar sistema ou logout/login
```

### Problema: Permission denied ao executar script

**Sintoma:** `bash: ./scripts/rip.sh: Permission denied`

**Solução:**

```bash
chmod +x scripts/*.sh setup/*.sh
```

### Problema: Erro ao construir imagem Docker

**Sintoma:** `Error building Docker image`

**Solução:**

```bash
# Limpar cache e reconstruir
docker system prune -a
docker-compose build --no-cache
```

### Problema: Download muito lento

**Possíveis causas:**

1. Sua conexão de internet
2. Muitos downloads simultâneos

**Solução:**

```bash
# Editar config.toml
nano config/.config/streamrip/config.toml

# Ajustar estas configurações:
max_connections = 3         # Reduzir para 2 ou 3
requests_per_minute = 60    # Deixar padrão
```

### Problema: Erro "Invalid quality"

**Sintoma:** Qualidade solicitada não disponível

**Solução:**

- Qualidades 2 e 3 requerem **Tidal HiFi**
- Use qualidade 1 se tiver apenas Tidal Normal
- Verifique sua assinatura no site do Tidal

---

## 📚 Documentação Adicional

Para informações mais detalhadas, consulte a documentação na pasta `docs/`:

### 📖 [docs/readme.md](docs/readme.md)

Documentação completa com todos os detalhes de uso, configuração e troubleshooting.

### 🎵 [docs/TIDAL_GUIDE.md](docs/TIDAL_GUIDE.md)

Guia completo do script `tidal.sh`:

- Todas as funções disponíveis
- Exemplos práticos
- Workflows recomendados
- Dicas e truques

### ⚡ [docs/QUICK_REFERENCE.md](docs/QUICK_REFERENCE.md)

Referência rápida com comandos mais usados:

- Comandos básicos
- Download de álbuns e playlists
- Conversão de formatos
- Tabela de qualidades
- Gerenciamento Docker

### ⚙️ [docs/CONFIG_GUIDE.md](docs/CONFIG_GUIDE.md)

Guia de configuração detalhado:

- Como obter credenciais (Tidal, Qobuz, Deezer)
- Todas as opções do `config.toml`
- Exemplos de configuração
- Formatos de arquivo
- Metadados

### 🔒 [docs/PERMISSIONS.md](docs/PERMISSIONS.md)

Gerenciamento de permissões:

- Como funciona o sistema de permissões
- Troubleshooting de permissões
- Scripts de correção
- Detalhes técnicos

---

## 🎯 Recursos

- ✅ Downloads de **Qobuz, Tidal, Deezer e SoundCloud**
- ✅ **Menu interativo** para Tidal
- ✅ **Conversão automática** para vários formatos (MP3, FLAC, AAC, OPUS)
- ✅ **Gerenciamento de permissões** automático
- ✅ **Execução via Docker** (isolado do sistema)
- ✅ **Scripts auxiliares** e funções prontas
- ✅ **Busca integrada** em todos os serviços
- ✅ **Database** para evitar downloads duplicados
- ✅ **Organização clara** em pastas

---

## 📝 Notas Importantes

### Legalidade

- Use apenas para músicas que você tem direito de baixar
- Respeite os termos de serviço das plataformas
- Este projeto não encoraja pirataria

### Qualidade

- **Tidal HiFi**: Melhor opção para MQA (24-bit)
- **Qobuz**: Melhor opção para Hi-Res (até 192kHz)
- **Deezer**: Boa alternativa em FLAC CD quality
- A qualidade final depende da sua assinatura

### Backups

- Faça backup do seu `config.toml` após configurar
- Guarde seus tokens em local seguro
- Não compartilhe seu arquivo de configuração

### Atualizações

- Reconstrua a imagem periodicamente: `docker-compose build --no-cache`
- Verifique atualizações do streamrip no [GitHub](https://github.com/nathom/streamrip)

---

## 🔗 Links Úteis

- **[Streamrip GitHub](https://github.com/nathom/streamrip)** - Repositório oficial
- **[Streamrip Wiki](https://github.com/nathom/streamrip/wiki)** - Wiki oficial
- **[Command Line Reference](https://github.com/nathom/streamrip/wiki/Command-Line-Reference)** - Referência de comandos
- **[Issues](https://github.com/nathom/streamrip/issues)** - Reportar problemas

---

## 💬 Suporte

Se encontrar problemas:

1. **Consulte a documentação** em `docs/`
2. **Veja [Troubleshooting](#-troubleshooting)** neste README
3. **Verifique [Issues do Streamrip](https://github.com/nathom/streamrip/issues)**
4. **Execute os scripts de diagnóstico:**
   ```bash
   ./scripts/rip.sh --version
   docker --version
   ls -la config/ downloads/
   ```

---

**Feito com ❤️ para amantes de música em alta qualidade**
