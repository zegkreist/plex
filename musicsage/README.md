# MusicSage — Docker

Dashboard de músicas para Plex com análise de IA, downloads (Stormbringer) e integração Tidal (TideCaller).

---

## Início rápido

```bash
# 1. Copie o arquivo de variáveis de exemplo
cp musicsage/.env.example musicsage/.env
# edite conforme necessário

# 2. Suba o container
docker compose -f musicsage/docker-compose.yml up -d
```

Ou com `docker run` diretamente:

```bash
docker run -d \
  --name musicsage \
  --restart unless-stopped \
  -p 3002:3002 \
  --env-file musicsage/.env \
  -v /mnt/nas/musicsage-data:/data \
  -v /mnt/nas/media:/media:ro \
  -v /mnt/nas/downloads:/downloads \
  seu-usuario/musicsage:latest
```

---

## Buildando a imagem

O contexto de build deve ser a pasta `plex_server/` (raiz do monorepo):

```bash
cd plex_server/

# Build local:
docker build -f musicsage/Dockerfile -t musicsage:latest .

# Build + push para o DockerHub:
./musicsage/build-and-push.sh --user seu-usuario --tag v1.0.0
```

---

## Variáveis de ambiente

### Plex

| Variável | Obrigatória | Default | Descrição |
|---|---|---|---|
| `PLEX_URL` | ✓ | `http://localhost:32400` | URL base do servidor Plex |
| `PLEX_TOKEN` | ✓ | — | Token de autenticação Plex (X-Plex-Token) |
| `PLEX_MEDIA_PATH` | — | `/media` | Raiz local onde toda a mídia está montada. Paths do Plex (`/music/...`, `/movies/...`) são concatenados diretamente. |

### Ollama / IA

| Variável | Obrigatória | Default | Descrição |
|---|---|---|---|
| `OLLAMA_URL` | — | `http://localhost:11434` | URL do servidor Ollama |
| `OLLAMA_DEFAULT_MODEL` | — | `gemma4:e4b` | Modelo LLM para análise e chat |
| `EMBEDDING_MODEL` | — | `nomic-embed-text` | Modelo para geração de embeddings |

### Persistência

| Variável | Obrigatória | Default | Descrição |
|---|---|---|---|
| `DATA_DIR` | — | `/data` | Diretório raiz de dados persistentes |
| `LOG_DIR` | — | `/data/logs` | Diretório de logs |

### Agents

| Variável | Obrigatória | Default | Descrição |
|---|---|---|---|
| `STORMBRINGER_DIR` | — | `/agents/Stormbringer` | Localização do agent Stormbringer (já embarcado na imagem) |
| `TIDECALLER_DIR` | — | `/agents/TideCaller` | Localização do agent TideCaller (já embarcado na imagem) |
| `TRANSPORTER_DIR` | — | `/agents/Transporter` | Localização do agent Transporter (já embarcado na imagem) |

### Integrações opcionais

| Variável | Obrigatória | Default | Descrição |
|---|---|---|---|
| `LASTFM_API_KEY` | — | — | API Key do Last.fm para metadados|
| `MUSICSAGE_PORT` | — | `3002` | Porta do servidor HTTP |
| `NODE_ENV` | — | `production` | Ambiente Node.js |

---

## Volumes

| Ponto de montagem | Obrigatório | Descrição |
|---|---|---|
| `/data` | ✓ | Cache de análises, embeddings vetoriais, playlists geradas, logs. **Deve persistir entre restarts.** |
| `/media` | ✓ | Raiz de mídia. Subpastas: `music/`, `movies/`, `series/`. Recomendado montar como **read-only** (`:ro`). |
| `/downloads` | — | Pasta de downloads dos agents. Veja subdiretórios abaixo. |

### Subdiretórios de `/downloads`

| Caminho | Agent | Conteúdo |
|---|---|---|
| `/downloads/stormbringer/musicas` | Stormbringer | Músicas baixadas |
| `/downloads/stormbringer/filmes` | Stormbringer | Filmes baixados |
| `/downloads/stormbringer/series` | Stormbringer | Séries baixadas |
| `/downloads/tidecaller` | TideCaller | Downloads do Tidal |

> **Dica:** Monte `/downloads` num disco com espaço generoso. Em NAS Synology/QNAP, uma pasta dedicada em `/volume1/downloads` é suficiente.

---

## docker-compose.yml de exemplo

```yaml
services:
  musicsage:
    image: seu-usuario/musicsage:latest
    container_name: musicsage
    restart: unless-stopped
    ports:
      - "3002:3002"
    environment:
      PLEX_URL: "http://192.168.1.100:32400"
      PLEX_TOKEN: "seu-token-aqui"
      PLEX_MEDIA_PATH: /media
      OLLAMA_URL: "http://192.168.1.100:11434"
      OLLAMA_DEFAULT_MODEL: gemma4:e4b
      EMBEDDING_MODEL: nomic-embed-text
      LASTFM_API_KEY: "opcional"
    volumes:
      - musicsage-data:/data
      - /mnt/nas/media:/media:ro
      - musicsage-downloads:/downloads

volumes:
  musicsage-data:
  musicsage-downloads:
```

---

## Agents embarcados

Todos os agents estão **dentro da imagem** — não é necessário montar volumes extras para eles.

| Agent | Tipo | Localização na imagem | Função |
|---|---|---|---|
| **AllFather** | Node.js | `/agents/AllFather` | Orquestrador central de agentes |
| **Stormbringer** | Node.js | `/agents/Stormbringer` | Downloads (músicas, filmes, séries) |
| **TideCaller** | Python 3 | `/agents/TideCaller` | Busca e download no Tidal |
| **Transporter** | Node.js | `/agents/Transporter` | Transferência e organização de arquivos |

### Autenticação do Tidal (TideCaller)

Na primeira execução, o TideCaller precisará autenticar com o Tidal. O token OAuth é salvo em `/agents/TideCaller/config/.config`. Para persistir a autenticação entre recriações do container, monte a pasta de config:

```bash
-v tidal-config:/agents/TideCaller/config
```

Ou via `docker-compose.yml`:

```yaml
volumes:
  - tidal-config:/agents/TideCaller/config
```

---

## Health check

A imagem inclui health check automático:

```
GET http://localhost:3002/api/health
```

---

## Exemplo completo — NAS Synology

```bash
docker run -d \
  --name musicsage \
  --restart unless-stopped \
  -p 3002:3002 \
  -e PLEX_URL="http://192.168.1.100:32400" \
  -e PLEX_TOKEN="xxxxxxxxxxxxxxxxxx" \
  -e PLEX_MEDIA_PATH="/media" \
  -e OLLAMA_URL="http://192.168.1.100:11434" \
  -e OLLAMA_DEFAULT_MODEL="gemma4:e4b" \
  -e EMBEDDING_MODEL="nomic-embed-text" \
  -v /volume1/docker/musicsage/data:/data \
  -v /volume1/media:/media:ro \
  -v /volume1/downloads/musicsage:/downloads \
  seu-usuario/musicsage:latest
```
