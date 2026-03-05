# Plex Media Server

Servidor Plex pessoal com Docker, agentes de automação e IA local via Ollama.

## 📁 Estrutura do projeto

```
plex_server/
├── docker-compose.yml       # Configuração Docker (Plex + Ollama)
├── .env                     # Variáveis de ambiente (não commitar!)
├── plex-cli.js              # CLI central para operar os agentes
├── package.json             # Scripts npm (atalhos para o CLI)
├── ollama-setup.sh          # Gerenciamento de modelos Ollama
├── config/                  # Configurações do Plex (persistência)
├── tv/                      # Séries
├── movies/                  # Filmes
├── music/                   # Músicas
├── ollama/                  # Modelos LLM baixados
├── agents/
│   ├── AllFather/           # Biblioteca de IA compartilhada
│   ├── MusicCurator/        # Agente de curadoria de música
│   └── SeriesCurator/       # Agente de curadoria de séries
├── OLLAMA.md                # Documentação completa do Ollama
└── GPU-NVIDIA.md            # Guia de configuração GPU NVIDIA
```

---

## 🤖 Agentes

### 🧙 AllFather

Biblioteca compartilhada de IA, usada pelos outros agentes para se comunicar com o Ollama (LLMs locais).

- Encapsula toda a lógica de comunicação com o Ollama
- Fornece métodos `ask()`, `askWithContext()` e `askForJSON()`
- Permite que MusicCurator e SeriesCurator usem IA para decisões inteligentes
- Suporta controle de temperatura, reasoning on/off e respostas estruturadas em JSON

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

Operações usam `ffmpeg`/`ffprobe` para leitura e escrita de tags. Arquivos temporários vão para `/tmp` para evitar erros de permissão em diretórios criados pelo Docker.

📖 [Ver documentação completa →](agents/MusicCurator/README.md)

---

### 📺 SeriesCurator

Agente responsável por organizar a biblioteca de séries de TV.

**O que faz:**

- **Curadoria de séries**: varre todos os diretórios em `tv/`, identifica arquivos de episódio (`.mkv`, `.mp4`, `.avi`, etc.), agrupa por nome de série e temporada, e renomeia pastas e arquivos para o padrão `Nome da Série (Ano)/Season XX/S01E01 - Título.ext`
- **Agrupamento inteligente**: reconhece variantes do mesmo nome (`Game.of.Thrones`, `Game_of_Thrones` e `Game of Thrones` são tratados como a mesma série)
- **Consolidação de temporadas**: move episódios da mesma temporada espalhados em pastas diferentes para um único diretório
- **Correção de tags de vídeo**: atualiza as tags `title`, `season_number` e `episode_sort` nos arquivos `.mkv`/`.mp4` via `ffmpeg`
- **Integração com AllFather**: usa IA para identificar nomes canônicos de séries quando há ambiguidade
- **Dry-run**: modo simulação para revisar todas as mudanças antes de aplicar

Requer `sudo` porque o diretório `tv/` é criado como `root:root` pelo Docker.

📖 [Ver documentação completa →](agents/SeriesCurator/README.md)

---

## 🖥️ plex-cli — Operando os agentes

O `plex-cli.js` é o ponto central de controle. Pode ser executado da raiz do projeto.

### Modos de uso

```bash
# Menu interativo numerado
node plex-cli.js

# Executar comando diretamente
node plex-cli.js <comando>

# Listar todos os comandos disponíveis
node plex-cli.js --help

# Via npm (equivalente)
npm run cli
npm run <comando>
```

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

#### 🧪 Testes

| Comando       | Descrição                                           |
| ------------- | --------------------------------------------------- |
| `test:all`    | Roda todos os testes (MusicCurator + SeriesCurator) |
| `test:music`  | Apenas testes do MusicCurator                       |
| `test:series` | Apenas testes do SeriesCurator                      |

#### 🐳 Docker / Plex

| Comando        | Descrição                                         |
| -------------- | ------------------------------------------------- |
| `plex:status`  | Status dos containers (`docker compose ps`)       |
| `plex:start`   | Sobe todos os containers (`docker compose up -d`) |
| `plex:stop`    | Para todos os containers                          |
| `plex:restart` | Reinicia o container do Plex                      |
| `plex:logs`    | Logs do Plex (últimas 50 linhas, modo follow)     |
| `plex:scan`    | Força o Plex a reescanear as bibliotecas via API  |

### Variáveis de ambiente (`.env`)

```dotenv
PLEX_CLAIM=claim-xxxxxxxxxx   # Obtido em https://www.plex.tv/claim/ (só na 1ª execução)
PLEX_TOKEN=xxxxxxxxxxxx       # Token para comandos de API (plex:scan)
PUID=1000
PGID=1000
TZ=America/Sao_Paulo
MUSIC_PATH=/caminho/para/music
SERIES_PATH=/caminho/para/tv
```

> Para descobrir seu `PUID`/`PGID`: `id`

---

## 🚀 Setup do Plex

### Pré-requisitos

- Docker e Docker Compose instalados
- Conta Plex gratuita em <https://www.plex.tv/>
- Node.js 18+ (para os agentes)

### 1. Configure o `.env`

```bash
cp .env.example .env   # se existir, senão crie manualmente
```

Preencha pelo menos:

```dotenv
PLEX_CLAIM=claim-xxxxxxxxxx   # https://www.plex.tv/claim/  (válido por 4 min)
PUID=1000
PGID=1000
TZ=America/Sao_Paulo
MUSIC_PATH=/home/seu-usuario/plex_server/music
SERIES_PATH=/home/seu-usuario/plex_server/tv
```

### 2. Suba os containers

```bash
docker compose up -d
```

### 3. Configure o Plex pela primeira vez

Acesse <http://localhost:32400/web> e siga o assistente:

1. Faça login com sua conta Plex
2. Dê um nome ao servidor
3. Adicione as bibliotecas:
   - **Filmes** → `/movies`
   - **Séries** → `/tv`
   - **Música** → `/music`

### 4. Instale as dependências dos agentes

```bash
cd agents/MusicCurator && npm install && cd ../..
cd agents/SeriesCurator && npm install && cd ../..
```

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

O `docker-compose.yml` já inclui o serviço `ollama`. Basta subir:

```bash
docker compose up -d ollama

# Verificar se está rodando
curl http://localhost:11434
# Esperado: "Ollama is running"
```

Baixe um modelo leve para começar:

```bash
# Via script interativo
./ollama-setup.sh

# Ou direto
./ollama-setup.sh pull llama3.2:3b      # recomendado para CPU (3 GB)
./ollama-setup.sh pull llama3.2:1b      # ultra leve (1 GB), mais rápido
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
# Verificar se já está instalado
nvidia-smi

# Se não estiver, instalar (Ubuntu/Debian)
sudo ubuntu-drivers autoinstall
# Reinicie após instalar
```

#### 2. Instale o NVIDIA Container Toolkit

```bash
# Método automático (recomendado)
sudo ./setup-nvidia-docker.sh

# Método manual — Ubuntu/Debian
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

#### 3. Suba o Ollama com suporte a GPU

O `docker-compose.yml` já está configurado. Basta subir normalmente:

```bash
docker compose up -d ollama
```

#### 4. Verificar que a GPU está sendo usada

```bash
# Testar acesso à GPU no container
docker run --rm --gpus all nvidia/cuda:12.0.0-base-ubuntu22.04 nvidia-smi

# Verificar uso de GPU durante inferência
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

Certifique-se de que `PLEX_TOKEN` está definido no `.env`. Para obter o token: Settings → Account → no Plex Web, inspecione qualquer requisição à API — o token aparece como `X-Plex-Token`.

### Ollama lento (sem GPU)

Use modelos menores (`llama3.2:1b` ou `deepseek-r1:1.5b`). Para acelerar significativamente, configure a GPU NVIDIA conforme a seção acima.

---

## 🔗 Links úteis

- [Plex Official Website](https://www.plex.tv/)
- [Plex Docker Image (LinuxServer)](https://docs.linuxserver.io/images/docker-plex)
- [Ollama](https://ollama.com/)
- [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)
