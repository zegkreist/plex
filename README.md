# Plex Media Server — Monorepo

Servidor Plex pessoal com Docker, agentes de automação e IA local via Ollama.

## 📁 Estrutura do projeto

```
plex_server/
├── docker-compose.yml       # Configuração Docker (Plex + Ollama)
├── .env                     # Variáveis de ambiente (não commitar!)
├── plex-cli.js              # CLI central para operar todos os agentes
├── package.json             # npm workspaces (raiz) + scripts atalho
├── ollama-setup.sh          # Gerenciamento de modelos Ollama
├── config/                  # Configurações do Plex (persistência)
├── tv/                      # Séries
├── movies/                  # Filmes
├── music/                   # Músicas
├── ollama/                  # Modelos LLM baixados
├── agents/
│   ├── AllFather/           # Biblioteca de IA compartilhada
│   ├── MusicCurator/        # Agente de curadoria de música
│   ├── SeriesCurator/       # Agente de curadoria de séries
│   ├── Stormbringer/        # Agente de torrent + organização Plex
│   ├── TideCaller/          # Agente de download via Tidal (streamrip)
│   └── Transporter/         # Utilitários compartilhados (Node.js)
├── OLLAMA.md                # Documentação completa do Ollama
└── GPU-NVIDIA.md            # Guia de configuração GPU NVIDIA
```

> Os agentes Node.js são gerenciados como **npm workspaces**: um único `npm install` na raiz instala todas as dependências.

---

## 🤖 Agentes

### 🧙 AllFather

Biblioteca compartilhada de IA, usada pelos outros agentes para se comunicar com o Ollama (LLMs locais).

- Encapsula toda a lógica de comunicação com o Ollama
- Fornece métodos `ask()`, `askWithContext()` e `askForJSON()`
- Suporta controle de temperatura, reasoning on/off e respostas em JSON estruturado

```javascript
import { AllFather } from "@plex-agents/allfather";

const ai = new AllFather({ model: "deepseek-r1:1.5b", disableReasoning: true });

const genre = await ai.askWithContext("Qual o gênero desta música?", {
  trackName: "Bohemian Rhapsody",
  artist: "Queen",
});
```

---

### 🎵 MusicCurator

Agente responsável por organizar e normalizar a biblioteca de música.

**O que faz:**

- **Consolidação de biblioteca**: varre todos os álbuns em `music/`, normaliza nomes de pasta para o formato `Artista — Álbum (Ano)`, consolida faixas duplicadas e remove pastas vazias
- **Correção de tags ALBUM**: compara a tag `ALBUM` embutida em cada arquivo de áudio com o nome da pasta; reescreve via `ffmpeg` apenas onde há discrepância
- **Correção focada**: modo restrito que reprocessa somente álbuns já marcados como `[CURATED]`
- **Dry-run**: todos os comandos têm modo `--dry-run` que simula as mudanças sem tocar nos arquivos

📖 [Ver documentação completa →](agents/MusicCurator/README.md)

---

### 📺 SeriesCurator

Agente responsável por organizar a biblioteca de séries de TV.

**O que faz:**

- **Curadoria de séries**: varre `tv/`, identifica arquivos de episódio e renomeia pastas e arquivos para o padrão `Nome da Série (Ano)/Season XX/S01E01 - Título.ext`
- **Agrupamento inteligente**: reconhece variantes do mesmo nome (`Game.of.Thrones`, `Game_of_Thrones` → mesma série)
- **Consolidação de temporadas**: move episódios espalhados em pastas diferentes para um único diretório
- **Correção de tags de vídeo**: atualiza `title`, `season_number` e `episode_sort` via `ffmpeg`
- **Integração com AllFather**: usa IA para identificar nomes canônicos quando há ambiguidade
- **Dry-run**: modo simulação para revisar todas as mudanças antes de aplicar

> Requer `sudo` porque o diretório `tv/` é criado como `root:root` pelo Docker.

📖 [Ver documentação completa →](agents/SeriesCurator/README.md)

---

### ⚡ Stormbringer

Agente de torrent — busca, baixa e organiza mídia nas pastas do Plex automaticamente.

**O que faz:**

- **Daemon de downloads**: monitora um cliente de torrent (qBittorrent) e detecta downloads concluídos
- **Busca interativa**: pesquisa torrents por nome e filtra por qualidade, idioma e seeders
- **Organização automática**: move filmes, séries e músicas baixadas para `movies/`, `tv/` e `music/` no formato correto para o Plex
- **Fuzzy dedup de álbuns**: evita duplicatas usando similaridade de string (threshold 0.85) + detecção de recordings ao vivo (`live`, `ao vivo`, etc.)
- **Cover art**: extrai e salva capas de álbum a partir dos metadados de áudio (`music-metadata`)
- **Dry-run**: modo simulação para revisar antes de mover os arquivos

📖 [Ver documentação completa →](agents/Stormbringer/README.md)

---

### 🌊 TideCaller

Agente de download de alta qualidade via **Tidal** usando [streamrip](https://github.com/nathom/streamrip).

**O que faz:**

- **Download via Tidal**: baixa músicas, álbuns e playlists em até 24-bit/192kHz (MQA/FLAC)
- **Dockerizado**: roda sobre Python + streamrip em container isolado, sem poluir o sistema
- **Token auto-refresh**: mantém as credenciais do Tidal atualizadas via script
- **Organização de biblioteca**: integra com o fluxo de organização da `music/`

**Comandos via `plex-cli`:**

| Comando                       | Script interno                | Descrição                                                         |
| ----------------------------- | ----------------------------- | ----------------------------------------------------------------- |
| `tidecaller:rip`              | `scripts/rip.sh`              | Baixa uma URL do Tidal (álbum, faixa, playlist)                   |
| `tidecaller:download-artists` | `scripts/download_artists.sh` | Baixa todos os artistas em `artist_urls.txt`                      |
| `tidecaller:organize`         | `scripts/organize_albums.sh`  | Organiza os downloads na biblioteca                               |
| `tidecaller:enrich`           | `scripts/enrich_metadata.sh`  | Enriquece metadados via MusicBrainz                               |
| `tidecaller:refresh-token`    | `scripts/refresh_token.sh`    | Zera tokens + re-autentica (device auth interativo)               |
| `tidecaller:download-artist`  | `scripts/download_artist.sh`  | Busca artista no Tidal e baixa discografia ou álbuns selecionados |

📖 [Ver documentação completa →](agents/TideCaller/README.md)

---

### 🚚 Transporter

Biblioteca de utilitários compartilhados para organização de mídia, usada pelo Stormbringer (e futuramente pelo TideCaller).

**Módulos exportados (`@plex-agents/transporter`):**

| Módulo       | Funções principais                                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `strings`    | `sanitizeName`, `cleanAlbumName`, `normalizeForComparison`, `calculateSimilarity`                                                |
| `live`       | `isLiveRecording`                                                                                                                |
| `audio`      | `AUDIO_EXTENSIONS`, `isAudioFile`, `isDiscFolder`, `hasDirectAudio`, `isReleaseFolder`, `findAudioFiles`, `parseAlbumFolderName` |
| `filesystem` | `ensureDir`, `moveFile`, `removeIfEmpty`, `saveCoverArt`                                                                         |
| `dedup`      | `findExistingAlbumDir`                                                                                                           |

---

## 🖥️ plex-cli — Operando os agentes

O `plex-cli.js` é o ponto central de controle de todos os agentes. Roda a partir da raiz do projeto.

### Modos de uso

```bash
# Menu interativo numerado (recomendado para explorar)
node plex-cli.js

# Executar um comando diretamente (útil em scripts)
node plex-cli.js <comando>

# Listar todos os comandos disponíveis
node plex-cli.js --help

# Via npm scripts (atalhos equivalentes)
npm run cli
npm run <comando>
```

**Exemplos rápidos:**

```bash
node plex-cli.js stormbringer:plex-organize:dry   # preview antes de mover arquivos
node plex-cli.js stormbringer:search              # busca torrent interativamente
node plex-cli.js plex:scan                        # força re-scan das bibliotecas
npm run test:all                                  # roda todos os testes
```

---

### Comandos disponíveis

#### 🎵 Música

| Comando                  | Descrição                                          |
| ------------------------ | -------------------------------------------------- |
| `music:consolidate`      | Consolida biblioteca (normaliza pastas + tags)     |
| `music:fix-all-tags`     | Corrige tags ALBUM incorretas em toda a biblioteca |
| `music:fix-all-tags:dry` | Idem, sem aplicar mudanças (dry-run)               |
| `music:fix-tags`         | Corrige tags apenas nos álbuns já curados          |
| `music:fix-tags:dry`     | Idem, sem aplicar mudanças (dry-run)               |
| `music:test`             | Roda a suíte de testes do MusicCurator             |

#### 📺 Séries

| Comando               | Descrição                                                 |
| --------------------- | --------------------------------------------------------- |
| `series:curate`       | Cura a biblioteca de séries (requer sudo)                 |
| `series:curate:dry`   | Idem, sem aplicar mudanças (dry-run, requer sudo)         |
| `series:fix-tags`     | Corrige tags de vídeo dos episódios curados (requer sudo) |
| `series:fix-tags:dry` | Idem, sem aplicar mudanças (dry-run)                      |
| `series:test`         | Roda a suíte de testes do SeriesCurator                   |

#### ⚡ Stormbringer

| Comando                          | Descrição                                        |
| -------------------------------- | ------------------------------------------------ |
| `stormbringer:start`             | Inicia o daemon de downloads (fica rodando)      |
| `stormbringer:search`            | Busca torrent interativamente pelo nome          |
| `stormbringer:downloads`         | Lista status dos downloads em andamento          |
| `stormbringer:plex-organize`     | Move downloads concluídos para as pastas do Plex |
| `stormbringer:plex-organize:dry` | Idem, sem mover arquivos (dry-run)               |
| `stormbringer:test`              | Roda a suíte de testes do Stormbringer           |

#### 🌊 TideCaller

| Comando                       | Descrição                                                         |
| ----------------------------- | ----------------------------------------------------------------- |
| `tidecaller:rip`              | Baixar uma URL do Tidal (álbum, faixa ou playlist) via streamrip  |
| `tidecaller:download-artists` | Baixar discografias dos artistas listados em `artist_urls.txt`    |
| `tidecaller:organize`         | Organizar downloads do Tidal na biblioteca de música              |
| `tidecaller:enrich`           | Enriquecer metadados via MusicBrainz                              |
| `tidecaller:refresh-token`    | Zerar tokens expirados e re-autenticar no Tidal (device auth)     |
| `tidecaller:download-artist`  | Buscar artista no Tidal e baixar discografia ou álbuns escolhidos |

> **Nota:** `tidecaller:rip` precisa de uma URL como argumento adicional. Use diretamente no terminal: `cd agents/TideCaller && bash scripts/rip.sh url https://tidal.com/browse/album/...`

#### 🧪 Testes

| Comando             | Descrição                                                          |
| ------------------- | ------------------------------------------------------------------ |
| `test:all`          | Roda todos os testes (MusicCurator + SeriesCurator + Stormbringer) |
| `test:music`        | Apenas testes do MusicCurator                                      |
| `test:series`       | Apenas testes do SeriesCurator                                     |
| `test:stormbringer` | Apenas testes do Stormbringer                                      |

#### 🐳 Docker / Plex

| Comando        | Descrição                                         |
| -------------- | ------------------------------------------------- |
| `plex:status`  | Status dos containers (`docker compose ps`)       |
| `plex:start`   | Sobe todos os containers (`docker compose up -d`) |
| `plex:stop`    | Para todos os containers                          |
| `plex:restart` | Reinicia o container do Plex                      |
| `plex:logs`    | Logs do Plex (últimas 50 linhas, modo follow)     |
| `plex:scan`    | Força o Plex a reescanear as bibliotecas via API  |

---

## 🚀 Setup

### Pré-requisitos

- Docker e Docker Compose instalados
- Conta Plex gratuita em <https://www.plex.tv/>
- Node.js 18+

### 1. Configure o `.env`

```dotenv
PLEX_CLAIM=claim-xxxxxxxxxx     # https://www.plex.tv/claim/  (válido por 4 min, 1ª execução)
PLEX_TOKEN=xxxxxxxxxxxx         # Token para API do Plex (plex:scan)
PUID=1000
PGID=1000
TZ=America/Sao_Paulo
MUSIC_PATH=/caminho/para/music
SERIES_PATH=/caminho/para/tv
MOVIES_PATH=/caminho/para/movies
```

> Para descobrir seu `PUID`/`PGID`: `id`

### 2. Instale as dependências (todos os agentes de uma vez)

```bash
npm install
```

> O projeto usa **npm workspaces**. Um único `npm install` na raiz instala as dependências de todos os agentes Node.js (`AllFather`, `MusicCurator`, `SeriesCurator`, `Stormbringer`, `Transporter`) em um `node_modules/` compartilhado.

### 3. Suba os containers

```bash
docker compose up -d
```

### 4. Configure o Plex pela primeira vez

Acesse <http://localhost:32400/web> e siga o assistente:

1. Faça login com sua conta Plex
2. Dê um nome ao servidor
3. Adicione as bibliotecas:
   - **Filmes** → `/movies`
   - **Séries** → `/tv`
   - **Música** → `/music`

### Acessar o Plex

| Contexto | URL                                   |
| -------- | ------------------------------------- |
| Local    | <http://localhost:32400/web>          |
| Na rede  | `http://<IP-DO-SERVIDOR>:32400/web`   |
| Remoto   | Configure em Settings → Remote Access |

### Backup

```bash
tar -czf plex-backup-$(date +%Y%m%d).tar.gz config/
```

---

## 🦙 Setup do Ollama (LLM local)

O Ollama executa modelos de linguagem localmente, sem custo e sem internet. Os agentes usam o Ollama via **AllFather** para tarefas inteligentes.

### Sem GPU (CPU only)

```bash
docker compose up -d ollama

# Verificar se está rodando
curl http://localhost:11434
# Esperado: "Ollama is running"

# Baixar um modelo
./ollama-setup.sh pull llama3.2:3b      # recomendado para CPU (3 GB)
./ollama-setup.sh pull deepseek-r1:1.5b # padrão dos agentes (1 GB)
```

Modelos úteis para os agentes:

| Modelo             | Tamanho | Uso ideal                       |
| ------------------ | ------- | ------------------------------- |
| `llama3.2:1b`      | ~1 GB   | Testes, tarefas simples         |
| `llama3.2:3b`      | ~3 GB   | Uso geral, boa qualidade        |
| `deepseek-r1:1.5b` | ~1 GB   | Reasoning, padrão dos agentes   |
| `deepseek-r1:7b`   | ~4 GB   | Alta qualidade, requer mais RAM |

### Com GPU NVIDIA (5–10x mais rápido)

#### 1. Instale o driver NVIDIA

```bash
nvidia-smi   # verificar se já está instalado

# Se não estiver (Ubuntu/Debian):
sudo ubuntu-drivers autoinstall
# Reinicie após instalar
```

#### 2. Instale o NVIDIA Container Toolkit

```bash
# Método automático
sudo ./setup-nvidia-docker.sh

# Ou manualmente (Ubuntu/Debian)
distribution=$(. /etc/os-release; echo $ID$VERSION_ID)
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey \
  | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list \
  | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' \
  | sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

#### 3. Suba o Ollama com GPU

```bash
docker compose up -d ollama

# Verificar uso de GPU
watch -n1 nvidia-smi
```

📖 [Guia completo de GPU NVIDIA →](GPU-NVIDIA.md)
📖 [Documentação completa do Ollama →](OLLAMA.md)

---

## 🐛 Troubleshooting

### Container do Plex não inicia

```bash
docker compose logs plex
sudo lsof -i :32400   # verificar se a porta já está em uso
```

### Permissões nos diretórios de mídia

Os diretórios `tv/` e `music/` podem ser criados como `root:root` pelo Docker. Os comandos `series:curate` e `series:fix-tags` já usam `sudo` automaticamente via `plex-cli.js`.

### `plex:scan` não funciona

Certifique-se de que `PLEX_TOKEN` está definido no `.env`. Para obter o token: no Plex Web, inspecione qualquer requisição à API — o token aparece como `X-Plex-Token`.

### Ollama lento (sem GPU)

Use modelos menores (`llama3.2:1b` ou `deepseek-r1:1.5b`). Para acelerar significativamente, configure a GPU NVIDIA conforme a seção acima.

---

## 🔗 Links úteis

- [Plex Official Website](https://www.plex.tv/)
- [Plex Docker Image (LinuxServer)](https://docs.linuxserver.io/images/docker-plex)
- [Ollama](https://ollama.com/)
- [streamrip](https://github.com/nathom/streamrip)
- [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)
