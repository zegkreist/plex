# MusicSage — Feature Tracker

> Arquivo de rastreamento vivo. Atualizado a cada etapa da implementação.
> Use este arquivo para retomar contexto se perdido.

---

## Visão Geral

Agente `MusicSage` — webserver Express.js dentro do monorepo `plex_server`.

**Dois módulos principais:**
1. **Recommender** — analisa biblioteca + histórico → sugere artistas/músicas que *não* estão na biblioteca, usando Ollama (AllFather) para análise de gênero, mood, energia e timbre.
2. **Playlist Builder** — constrói playlists inteligentes a partir da biblioteca existente com critérios de mood/gênero/energia, e as **sincroniza bidirecionalmente com o Plex**.

---

## Arquitetura

```
agents/MusicSage/
├── FEATURE_TRACKER.md      ← este arquivo
├── package.json
├── jest.config.js
├── index.js                ← entry point (HTTP server + porta)
├── src/
│   ├── server.js           ← Express app factory (injetável para testes)
│   ├── logger.js           ← Logger singleton (arquivo + console)
│   ├── services/
│   │   ├── LibraryScanner.js       ← Plex API → artistas, álbuns, faixas
│   │   ├── HistoryService.js       ← Plex playback history (viewCount-based)
│   │   ├── MusicAnalyzer.js        ← AllFather: análise musical (gênero, mood...)
│   │   ├── RecommendationEngine.js ← combina biblioteca + histórico → recomendações
│   │   ├── PlaylistBuilder.js      ← gera e persiste playlists
│   │   ├── PlexService.js          ← CRUD de playlists no Plex via API REST
│   │   └── LastFmService.js        ← artistas semelhantes via Last.fm API
│   └── routes/
│       ├── health.js
│       ├── library.js
│       ├── recommendations.js
│       ├── playlists.js
│       └── tools.js
└── tests/
    ├── unit/
    │   ├── LibraryScanner.test.js
    │   ├── HistoryService.test.js
    │   ├── MusicAnalyzer.test.js
    │   ├── RecommendationEngine.test.js
    │   └── PlaylistBuilder.test.js
    └── integration/
        └── server.test.js
```

---

## API Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/health` | Status do servidor e dependências |
| GET | `/api/library/stats` | Estatísticas da biblioteca (totais, top gêneros) |
| GET | `/api/library/history` | Top artistas e faixas mais ouvidas (via Plex viewCount) |
| GET | `/api/recommendations` | Recomendações de artistas/músicas fora da biblioteca |
| GET | `/api/recommendations/artists` | Apenas recomendações de artistas |
| GET | `/api/recommendations/similar?artist=X` | Artistas semelhantes a X (Last.fm + Ollama) |
| POST | `/api/playlists/generate` | Gera playlist criativa da biblioteca |
| POST | `/api/playlists/from-prompt` | Gera playlist a partir de texto livre (Ollama interpreta) |
| GET | `/api/playlists` | Lista playlists salvas |
| GET | `/api/playlists/:id` | Retorna playlist específica |
| PATCH | `/api/playlists/:id` | Atualiza nome e/ou faixas (sincroniza com Plex em background) |
| DELETE | `/api/playlists/:id` | Remove playlist (e do Plex se sincronizada) |
| POST | `/api/playlists/:id/push-to-plex` | Cria/re-cria playlist no servidor Plex |

---

## Serviços e Responsabilidades

### LibraryScanner
- Conecta Plex API (`PLEX_URL` + `PLEX_TOKEN`)
- Plex types: `type=8` artistas, `type=9` álbuns, `type=10` faixas
- Método `scan()` → `{ artists[], albums[], tracks[] }` (com `ratingKey` por faixa)
- Método `getLibraryStats()` → totais + top gêneros

### HistoryService
- **Endpoint correto**: `GET /library/sections/{musicKey}/all?type=8&sort=viewCount:desc` (artistas)
- Método `_findMusicSection()` → detecta `musicKey` automaticamente via `/library/sections`
- Método `getFavoriteArtists(limit)` → `[{artist, playCount}]` ordenados por viewCount
- Método `getFavoriteTracks(limit)` → `[{title, artist, album, playCount}]`
- Método `getRecentlyPlayed(limit)` → faixas mais recentes (`sort=lastViewedAt:desc`)
- **Nota**: `/status/sessions/history/all` não funciona por default no Plex.

### MusicAnalyzer
- Usa **AllFather** (`askForJSON`) para análise de perfil musical
- Método `analyzeArtist(name, genres, sampleTracks)` → `{genre, mood, energy, timbre, characteristics[]}`
- Método `buildLibraryProfile(artists[])` → `{topGenres[], dominantMood, avgEnergy}`
- Método `analyzeListeningTaste(history[])` → `{preferredGenres[], patterns}`

### RecommendationEngine
- Combina perfil de biblioteca + histórico (top artistas rankeados) para prompt ao Ollama
- Filtra artistas já existentes na biblioteca
- Prompt inclui: top-3 âncoras (MUST appeal to fans of), listas numeradas de artistas/faixas
- Método `recommend({ limit, genre? })` → `[{artist, description, genre, whyRecommended}]`
- Método `recommendArtists({ limit })` → artistas-only
- Método `similarTo(artist, limit)` → artistas semelhantes via Last.fm + re-rank por Ollama

### PlaylistBuilder
- Usa AllFather para selecionar faixas que atendam critério
- Armazena em `Map` in-memory + JSON file em `mediasage/playlists/playlists.json`
- Persiste `plexId` (ratingKey da playlist no Plex) para sincronização
- Método `generate({ mood, genre, energy, size, name })` → `{ id, name, tracks[], createdAt }`
- Método `generateFromPrompt(text)` → extrai parâmetros via AllFather → chama `generate()`
- Método `update(id, { name?, tracks?, plexId? })` → merge + redesalva em disco
- Métodos CRUD: `save`, `list`, `get(id)`, `delete(id)`

### PlexService
- Integração REST direta com o Plex Media Server para playlists
- `getMachineIdentifier()` → machineId (cacheado) para construir URIs
- `pushPlaylist(name, ratingKeys)` → POST /playlists → `{ plexId }`
- `deletePlaylist(plexRatingKey)` → DELETE /playlists/:id
- `renamePlaylist(plexRatingKey, newName)` → PUT /playlists/:id?title=...
- `updatePlaylistTracks(plexRatingKey, name, ratingKeys)` → deletePlaylist + pushPlaylist

### LastFmService
- Busca artistas semelhantes via `artist.getSimilar` da Last.fm API
- Retorna lista com `name`, `similarity` (0–1), `mbid`
- Fallback silencioso se `LASTFM_API_KEY` não estiver configurado

---

## Sincronização Plex (Playlists)

### Comportamento por operação:

| Operação | Condição | Ação no Plex |
|---|---|---|
| `PATCH name` | `plexId` existe | `PUT /playlists/:id?title=newName` (rename) |
| `PATCH tracks` (não vazias) | `plexId` existe | delete + pushPlaylist (novo `plexId` salvo) |
| `PATCH tracks` (vazia) | `plexId` existe | `DELETE /playlists/:id` + `plexId=null` |
| `DELETE` playlist | `plexId` existe | `DELETE /playlists/:id` |
| `push-to-plex` | `plexId` existe | delete antigo + pushPlaylist (overwrite) |

### Auto-healing:
- Se `renamePlaylist` falhar (plexId obsoleto) → sistema **recria** automaticamente a playlist
- Se `updatePlaylistTracks` falhar → também recria
- Todas as operações Plex são em **background** (não bloqueiam a resposta HTTP)

---

## Stack Técnica

- **Runtime**: Node.js 22 ESM (`"type": "module"`)
- **Webserver**: Express.js — porta `3002` (configurável por `MUSICSAGE_PORT`)
- **HTTP client**: axios (para Plex API e Last.fm)
- **IA**: AllFather → Ollama (`qwen3:14b` recomendado)
- **Testes**: Jest + Supertest, padrão TDD (red → green → refactor)
- **Injeção de dependências**: Todos os serviços aceitam deps no construtor (facilita mocks)

---

## Variáveis de Ambiente

```env
PLEX_URL=http://localhost:32400
PLEX_TOKEN=<token>
OLLAMA_URL=http://192.168.15.94:11434
OLLAMA_DEFAULT_MODEL=qwen3:14b
MUSICSAGE_PORT=3002
LASTFM_API_KEY=<chave-opcional>   # habilita artistas semelhantes via Last.fm
MUSICSAGE_DEBUG=1                 # habilita logs DEBUG no console (opcional)
```

---

## TODO / Progresso

### Fase 1 — Scaffolding ✅
- [x] FEATURE_TRACKER.md criado
- [x] package.json, jest.config.js

### Fase 2 — Testes TDD (Red → Green) ✅
- [x] `tests/unit/LibraryScanner.test.js` ✅
- [x] `tests/unit/HistoryService.test.js` ✅ (testando endpoint correto viewCount)
- [x] `tests/unit/MusicAnalyzer.test.js` ✅
- [x] `tests/unit/RecommendationEngine.test.js` ✅
- [x] `tests/unit/PlaylistBuilder.test.js` ✅
- [x] `tests/integration/server.test.js` ✅ (inclui PATCH Plex-sync tests)

**Total: 82 testes, 82 passando ✅**

### Fase 3 — Implementação ✅
- [x] Todos os serviços e rotas implementados

### Fase 4 — Integração no Monorepo ✅
- [x] Workspaces, scripts, dependências instaladas

### Fase 5 — Extensões do PlaylistBuilder ✅
- [x] `generateFromPrompt(text)`
- [x] `update(id, fields)`

### Fase 6 — Frontend SPA ✅ (redesenhado)
- [x] `src/routes/playlists.js` — CRUD completo + POST /push-to-plex + PATCH sync
- [x] `public/index.html` — SPA dark-theme redesenhada:
  - [x] Layout de 2 painéis para Playlists (lista esquerda + detalhe direita)
  - [x] Dashboard com stats grid, top gêneros e history de artistas/faixas
  - [x] Recomendações: grid filtráveis + painel recolhível de artistas semelhantes
  - [x] Nova Playlist: tabs Por Critérios e Por Prompt
  - [x] Downloads: Stormbringer, TideCaller (URL + Artista), Transporter
  - [x] Monitor de downloads ativo com barra de progresso

### Fase 7 — Logging ✅
- [x] `src/logger.js` — logs diários em `mediasage/logs/musicsage-YYYY-MM-DD.log`
- [x] Suprime em `NODE_ENV=test`, nível DEBUG só com `MUSICSAGE_DEBUG=1`

### Fase 8 — HistoryService Fix ✅
- [x] Reescrito para usar `/library/sections/{id}/all?type=8&sort=viewCount:desc`
- [x] `_findMusicSection()` detecta música automaticamente

### Fase 9 — Sincronização Plex ✅
- [x] `PlexService` com rename, update tracks (delete+push), delete
- [x] PATCH route: sync automático em background (rename ou update tracks)
- [x] DELETE route: remove do Plex em background
- [x] push-to-plex: deleta versão anterior antes de recriar (overwrite seguro)
- [x] Auto-healing: recria playlist se plexId estiver obsoleto
- [x] Testes de integração para todos os casos de Plex sync

### Fase 10 — Artistas Semelhantes ✅
- [x] `LastFmService` para busca via Last.fm API
- [x] `GET /api/recommendations/similar?artist=X` — Last.fm + re-rank Ollama
- [x] Frontend: painel recolhível na tela de Recomendações

---

## Decisões de Design

| Decisão | Justificativa |
|---------|---------------|
| Dependency injection em todos os serviços | Permite mocks nos testes sem `jest.mock()` com ESM |
| `createServer(deps)` factory no server.js | Server testável sem ligar à porta real |
| AllFather com `askForJSON()` para análise | Retorno estruturado e previsível |
| Playlists em memória + JSON file | Simples, sem DB extra; persiste entre reinícios |
| Sync Plex em background (não bloqueia HTTP) | UX responsivo; falhas Plex não afetam a aplicação |
| delete+push para atualizar tracks no Plex | Plex não tem API de "substituir itens" de playlist |
| Auto-healing no sync | plexId pode ficar obsoleto se a playlist for deletada do Plex manualmente |

---

## Contexto do Projeto

- Monorepo com npm workspaces em `/home/developer/workspace/plex_server/`
- Outros agentes: AllFather, MusicCurator, SeriesCurator, Stormbringer, Transporter
- `mediasage/` na raiz = pasta de dados (config, db, playlists JSON, logs)
- Plex corre em Docker na rede host, porta 32400
- Ollama corre no host `192.168.15.94`, porta 11434, modelo `qwen3:14b`


---

## Arquitetura

```
agents/MusicSage/
├── FEATURE_TRACKER.md      ← este arquivo
├── package.json
├── jest.config.js
├── index.js                ← entry point (HTTP server + porta)
├── src/
│   ├── server.js           ← Express app factory (injetável para testes)
│   ├── services/
│   │   ├── LibraryScanner.js       ← Plex API → artistas, álbuns, faixas
│   │   ├── HistoryService.js       ← Plex playback history
│   │   ├── MusicAnalyzer.js        ← AllFather: análise musical (gênero, mood...)
│   │   ├── RecommendationEngine.js ← combina biblioteca + histórico → recomendações
│   │   └── PlaylistBuilder.js      ← gera e persiste playlists
│   └── routes/
│       ├── health.js
│       ├── library.js
│       ├── recommendations.js
│       └── playlists.js
└── tests/
    ├── unit/
    │   ├── LibraryScanner.test.js
    │   ├── HistoryService.test.js
    │   ├── MusicAnalyzer.test.js
    │   ├── RecommendationEngine.test.js
    │   └── PlaylistBuilder.test.js
    └── integration/
        └── server.test.js
```

---

## API Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/health` | Status do servidor e dependências |
| GET | `/api/library/stats` | Estatísticas da biblioteca (totais, top gêneros) |
| GET | `/api/recommendations` | Recomendações de artistas/músicas fora da biblioteca |
| GET | `/api/recommendations/artists` | Apenas recomendações de artistas |
| POST | `/api/playlists/generate` | Gera playlist criativa da biblioteca |
| POST | `/api/playlists/from-prompt` | Gera playlist a partir de texto livre (Ollama interpreta) |
| GET | `/api/playlists` | Lista playlists salvas |
| GET | `/api/playlists/:id` | Retorna playlist específica |
| PATCH | `/api/playlists/:id` | Atualiza nome e/ou faixas de uma playlist |
| DELETE | `/api/playlists/:id` | Remove playlist |

---

## Serviços e Responsabilidades

### LibraryScanner
- Conecta Plex API (`PLEX_URL` + `PLEX_TOKEN`)
- Plex types: `type=8` artistas, `type=9` álbuns, `type=10` faixas
- Método `scan()` → `{ artists[], albums[], tracks[] }`
- Método `getLibraryStats()` → totais + top gêneros

### HistoryService
- Endpoint Plex: `GET /status/sessions/history/all?sort=viewedAt:desc&type=10`
- Método `getRecentlyPlayed(limit)` → `[{title, artist, album, playedAt}]`
- Método `getFavoriteArtists(limit)` → artistas ordenados por play count

### MusicAnalyzer
- Usa **AllFather** (`askForJSON`) para análise de perfil musical
- Método `analyzeArtist(name, genres, sampleTracks)` → `{genre, mood, energy, timbre, characteristics[]}`
- Método `buildLibraryProfile(artists[])` → `{topGenres[], dominantMood, avgEnergy}`
- Método `analyzeListeningTaste(history[])` → `{preferredGenres[], patterns}`

### RecommendationEngine
- Combina perfil de biblioteca + histórico para prompt ao Ollama
- Filtra artistas já existentes na biblioteca
- Método `recommend({ limit })` → `[{artist, description, genre, whyRecommended}]`
- Método `recommendArtists({ limit })` → artist-only recommendations

### PlaylistBuilder
- Usa AllFather para selecionar faixas que atendam critério
- Armazena em `Map` in-memory (+ JSON file em `../../mediasage/playlists/`)
- Método `generate({ mood, genre, energy, size, name })` → `{ id, name, tracks[], createdAt }`
- Método `generateFromPrompt(text)` → extrai parâmetros via AllFather → chama `generate()` ✅ **NOVO**
- Método `update(id, { name?, tracks? })` → merge + redesalva em disco ✅ **NOVO**
- Métodos CRUD: `save`, `list`, `get(id)`, `delete(id)`

---

## Stack Técnica

- **Runtime**: Node.js ESM (`"type": "module"`)
- **Webserver**: Express.js
- **HTTP client**: axios (para Plex API)
- **IA**: AllFather → Ollama (`deepseek-r1:14b` ou `deepseek-r1:1.5b`)
- **Testes**: Jest + Supertest, padrão TDD (red → green → refactor)
- **Injeção de dependências**: Todos os serviços aceitam deps no construtor (facilita mocks)

---

## Variáveis de Ambiente

```env
PLEX_URL=http://localhost:32400
PLEX_TOKEN=<token>
OLLAMA_URL=http://localhost:11434
OLLAMA_DEFAULT_MODEL=deepseek-r1:14b-qwen-distill-q4_K_M
MUSICSAGE_PORT=3001
```

---

## TODO / Progresso

### Fase 1 — Scaffolding ✅
- [x] FEATURE_TRACKER.md criado
- [x] package.json
- [x] jest.config.js

### Fase 2 — Testes TDD (Red → Green) ✅
- [x] `tests/unit/LibraryScanner.test.js` — 9 testes ✅
- [x] `tests/unit/HistoryService.test.js` — 11 testes ✅
- [x] `tests/unit/MusicAnalyzer.test.js` — 9 testes ✅
- [x] `tests/unit/RecommendationEngine.test.js` — 9 testes ✅
- [x] `tests/unit/PlaylistBuilder.test.js` — 15 testes ✅
- [x] `tests/integration/server.test.js` — 15 testes ✅

**Total: 68 testes, 68 passando ✅**

### Fase 3 — Implementação (Green) ✅
- [x] `src/services/LibraryScanner.js`
- [x] `src/services/HistoryService.js`
- [x] `src/services/MusicAnalyzer.js`
- [x] `src/services/RecommendationEngine.js`
- [x] `src/services/PlaylistBuilder.js`
- [x] `src/routes/health.js`
- [x] `src/routes/library.js`
- [x] `src/routes/recommendations.js`
- [x] `src/routes/playlists.js`
- [x] `src/server.js`
- [x] `index.js`

### Fase 4 — Integração no Monorepo ✅
- [x] Adicionado ao `workspaces` no `package.json` raiz
- [x] Scripts `musicsage:start` e `musicsage:test` registados em `plex-cli.js`
- [x] `npm install` executado — dependências instaladas

### Fase 5 — Extensões do PlaylistBuilder ✅
- [x] `PlaylistBuilder.generateFromPrompt(text)` — LLM interpreta texto → extrai parâmetros → chama `generate()`
- [x] `PlaylistBuilder.update(id, fields)` — edita nome e/ou faixas de playlist existente

### Fase 6 — Frontend SPA ✅
- [x] `src/routes/playlists.js` — adicionados `POST /from-prompt` e `PATCH /:id`
- [x] `src/server.js` — `express.static('public')` + SPA catch-all `GET *`
- [x] `public/index.html` — SPA dark-theme completa:
  - [x] Sidebar: Dashboard | Recomendações | Playlists | Nova Playlist
  - [x] Dashboard: cards com stats da biblioteca (artistas, álbuns, faixas) + status online/offline
  - [x] Recomendações: grid de artistas com género, descrição e "por quê", filtros por género, botão Atualizar
  - [x] Playlists: lista → expande → edição inline de nome → remoção de faixas → delete
  - [x] Nova Playlist: tab "Por Critérios" (mood, género, energia, tamanho) + tab "Por Prompt" (textarea livre)
- [x] `claude.md` atualizado com instruções de uso do MusicSage

### Fase 7 — Lições aprendidas / Fix notáveis
- **PlaylistBuilder storage isolation**: `_loadFromDisk()` chamado no construtor causava
  contaminação entre testes (dados persistidos de runs anteriores). Solução: opção
  `storageFile: false` desabilita persistência em disco — passa nos construtor do teste.

### Fase 8 — Sistema de Logging ✅
- [x] `src/logger.js` — singleton logger criado
  - Sem dependências externas (usa só `fs`, `path`, `url`)
  - Logs diários em `mediasage/logs/musicsage-YYYY-MM-DD.log`
  - Suprime TUDO (arquivo + console) em `NODE_ENV=test`
  - Nível DEBUG só aparece no console se `MUSICSAGE_DEBUG=1`
  - Categorias: `SERVER | HTTP | LIBRARY | PLAYLIST | RECOMMEND | OLLAMA`
  - Método helper: `logger.http(method, path, status, ms)`
  - Formato: `2026-03-31 10:45:22.123 [INFO ] [PLAYLIST  ] Message — {extra}`
- [x] `src/server.js` — middleware HTTP logging (método, rota, status, latência)
- [x] `src/services/PlaylistBuilder.js` — logging em todos os métodos públicos
- [x] `src/services/RecommendationEngine.js` — logging em `recommend()`
- [x] `index.js` — console.log/warn/error substituídos por `logger.*`; import `HistoryService` adicionado (estava faltando)

**Variáveis de ambiente adicionais:**
```env
MUSICSAGE_DEBUG=1       # habilita logs DEBUG no console (opcional)
```

**Localização dos logs:**
```
plex_server/mediasage/logs/musicsage-YYYY-MM-DD.log
```
- **Padrão DI consistente**: Todos os serviços recebem `axios`, `allfather`, `libraryScanner`
  pelo construtor → zero `jest.mock()` com ESM, 100% DI.

---

## Decisões de Design

| Decisão | Justificativa |
|---------|---------------|
| Dependency injection em todos os serviços | Permite mocks nos testes sem `jest.mock()` com ESM |
| `createServer(deps)` factory no server.js | Server testável sem ligar à porta real |
| AllFather com `askForJSON()` para análise | Retorno estruturado e previsível |
| Playlists em memória + JSON file | Simples, sem DB extra; persiste entre reinícios |
| Serviço `MusicAnalyzer` separado | Permite testar análise AI de forma isolada |

---

## Contexto do Projeto

- Monorepo com npm workspaces em `/home/developer/workspace/plex_server/`
- Outros agentes: AllFather, MusicCurator, SeriesCurator, Stormbringer, Transporter
- `mediasage/` na raiz = pasta de dados (config, db, playlists JSON)
- Plex corre em Docker na rede host, porta 32400
- Ollama corre em Docker (ou local), porta 11434
