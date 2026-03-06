# 🎬 Torrent Download Manager 🎵

Sistema completo de gerenciamento de downloads via torrent para filmes, séries e músicas, desenvolvido em Node.js.

## ✨ Funcionalidades

- 🔍 **Busca Inteligente**: Busca os melhores torrents com sistema de ranqueamento por seeders, qualidade e tamanho
- 📥 **Download Gerenciado**: Download via WebTorrent com progresso em tempo real
- 📂 **Organização Automática**:
  - Filmes → `downloads/filmes/Nome do Filme (Ano)/`
  - Séries → `downloads/series/Nome da Série/Season XX/`
  - Músicas → `downloads/musicas/artista/album/`
- 🎬 **Enriquecimento de Metadados**:
  - Renomeação automática seguindo padrões (ex: `Breaking Bad - S01E01 - Pilot [1080p].mkv`)
  - Download de posters e fanarts
  - Criação de arquivos NFO (compatível com Kodi/Plex/Jellyfin)
  - Integração com TMDB (The Movie Database)
- 📺 **Rastreamento de Séries**: Monitora séries em lançamento e baixa novos episódios automaticamente
- 🎭 **Download de Temporada Inteira**: Opção de baixar todos os episódios de uma temporada de uma vez
- ⏰ **Agendamento**: Verificação automática de novos episódios a cada 6 horas

## 📦 Instalação

```bash
# Instalar dependências
npm install
```

## 🧪 Testes

O projeto inclui uma suite completa de testes de integração (sem mocks):

```bash
# Executar todos os testes
npm test

# Testes com cobertura
npm run test:coverage

# Modo watch para desenvolvimento
npm run test:watch
```

**Nota:** Os testes fazem requisições reais para APIs externas e downloads de torrents legais. Consulte [tests/README.md](tests/README.md) para mais detalhes.

## 🚀 Uso

### Comandos Principais

#### 1. Buscar Torrents

```bash
npm run search
# ou
node src/cli.js search
```

Permite buscar torrents de filmes, séries ou músicas interativamente.

#### 2. Buscar e Baixar

```bash
npm run download
# ou
node src/cli.js download
```

Busca e baixa torrents em um único comando.

#### 3. Rastrear Série

```bash
npm run track-series
# ou
node src/cli.js track-series
```

Adiciona uma série para rastreamento automático. O sistema verificará periodicamente se há novos episódios disponíveis.

#### 4. Listar Séries Rastreadas

```bash
node src/cli.js list-tracked
```

Mostra todas as séries que estão sendo rastreadas.

#### 5. Verificar Novos Episódios

```bash
npm run check-series
# ou
node src/cli.js check-series
```

Verifica manualmente se há novos episódios das séries rastreadas.

#### 6. Iniciar Monitoramento Automático

```bash
node src/cli.js start-monitor
```

Inicia o monitoramento contínuo que verifica e baixa automaticamente novos episódios.

## 📁 Estrutura de Diretórios

```
torrent_downloads/
├── src/
│   ├── cli.js                # Interface CLI principal
│   ├── index.js              # Ponto de entrada
│   ├── torrentSearch.js      # Módulo de busca de torrents
│   ├── downloadManager.js    # Gerenciador de downloads
│   ├── seriesTracker.js      # Rastreador de séries
│   └── metadataEnricher.js   # Enriquecimento de metadados
├── tests/                    # Suite de testes
│   ├── torrentSearch.test.js
│   ├── downloadManager.test.js
│   ├── seriesTracker.test.js
│   ├── metadataEnricher.test.js
│   └── README.md
├── downloads/                # Diretório de downloads
│   ├── filmes/
│   ├── series/
│   └── musicas/
├── config.json               # Configurações
├── series_tracker.json       # Dados de séries rastreadas
└── package.json
```

## ⚙️ Configuração

Edite o arquivo `config.json` para personalizar:

```json
{
  "downloads": {
    "baseDir": "./downloads",
    "movies": "./downloads/filmes",
    "series": "./downloads/series",
    "music": "./downloads/musicas"
  },
  "torrent": {
    "maxConnections": 100,
    "downloadLimit": -1,
    "uploadLimit": -1
  },
  "search": {
    "providers": ["1337x", "ThePirateBay", "Torrentz2"],
    "resultsLimit": 10
  },
  "series": {
    "checkInterval": "0 */6 * * *",
    "trackerFile": "./series_tracker.json"
  },
  "metadata": {
    "tmdbApiKey": "",
    "enabled": true,
    "downloadPosters": true,
    "downloadFanart": true,
    "createNFO": true,
    "renameFiles": true
  }
}
```

### 🔑 Configurar API do TMDB (Opcional mas Recomendado)

Para enriquecimento completo de metadados, configure uma chave de API gratuita do TMDB:

1. Acesse [www.themoviedb.org](https://www.themoviedb.org/) e crie uma conta
2. Vá em Configurações → API → Solicitar chave de API
3. Cole a chave no campo `tmdbApiKey` do `config.json`

**Com TMDB configurado você terá:**

- ✅ Nomes corretos e padronizados de filmes/séries
- ✅ Posters e fanarts em alta qualidade
- ✅ Informações detalhadas (sinopse, classificação, gêneros)
- ✅ Arquivos NFO completos para media centers

**Sem TMDB:**

- ⚠️ Funcionará, mas sem metadados ricos
- ⚠️ Renomeação básica apenas
- ⚠️ Sem posters/fanarts

### Intervalos de Verificação (cron)

- `"0 */6 * * *"` - A cada 6 horas
- `"0 */3 * * *"` - A cada 3 horas
- `"0 0 * * *"` - Uma vez por dia (meia-noite)
- `"0 */1 * * *"` - A cada hora

## 🎯 Exemplos de Uso

### Baixar um Filme

```bash
$ npm run download
? O que você quer baixar? Filme
? Nome do filme: Inception
? Ano (opcional): 2010

📋 Resultados:
1. Inception (2010) [1080p] BluRay
   Seeders: 1234 | Size: 2.1 GB
   Score: 85/100

? Qual torrent deseja baixar? 1

📥 Iniciando download...
⬇️ 45.32% | ↓ 5.2 MB/s | ↑ 1.1 MB/s | 👥 45 peers
```

### Rastrear uma Série

```bash
$ npm run track-series
? Nome da série: The Mandalorian
? Temporada atual: 3
? Último episódio baixado: 5

✅ Série adicionada ao rastreamento: The Mandalorian S03E05
```

### Verificar Novos Episódios

```bash
$ npm run check-series

🔍 Verificando novos episódios...

Verificando: The Mandalorian...
🆕 Novo episódio encontrado: The Mandalorian S03E06 - Chapter 22

? Deseja baixar este episódio agora? Yes
✓ Busca concluída!

📥 Iniciando download...
```

## 📊 Sistema de Ranqueamento

O sistema classifica torrents baseado em:

1. **Seeders** (máx 50 pontos): Mais seeders = download mais rápido
2. **Tamanho** (máx 30 pontos): Tamanho ideal para cada tipo
   - Filmes: 1.5GB - 10GB
   - Episódios: 200MB - 2GB
   - Música: 50MB - 500MB
3. **Qualidade** (máx 20 pontos): Resolução e codec
   - 4K/2160p, 1080p, 720p
   - x265/HEVC, FLAC

## 🎵 Organização de Música

Músicas são automaticamente organizadas na estrutura:

```
downloads/musicas/
└── Nome do Artista/
    └── Nome do Álbum/
        ├── track1.mp3
        ├── track2.mp3
        └── ...
```

## 📺 Rastreamento de Séries

O sistema usa a API do TVMaze para:

- Identificar séries corretamente
- Verificar datas de lançamento
- Detectar novos episódios automaticamente
- Baixar episódios assim que disponíveis

## 🛠️ Tecnologias Utilizadas

- **WebTorrent**: Cliente torrent em Node.js
- **torrent-search-api**: Busca em múltiplos provedores
- **Commander**: CLI framework
- **Inquirer**: Prompts interativos
- **Chalk**: Formatação de texto colorido
- **Ora**: Spinners de loading
- **node-cron**: Agendamento de tarefas
- **Axios**: Requisições HTTP
- **TVMaze API**: Informações de séries

## ⚠️ Avisos Legais

Este software é apenas para fins educacionais. Certifique-se de:

- Baixar apenas conteúdo de domínio público ou do qual você possui os direitos
- Respeitar as leis de direitos autorais do seu país
- Usar uma VPN se necessário para proteger sua privacidade

## 🐛 Troubleshooting

### Erro "Cannot find module"

```bash
npm install
```

### Downloads lentos

- Verifique sua conexão com a internet
- Escolha torrents com mais seeders
- Configure limites no `config.json`

### Série não encontrada

- Verifique o nome exato da série
- Tente usar o nome em inglês
- Alguns shows podem não estar na API do TVMaze

## 📝 Licença

MIT

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues ou pull requests.

---

**Desenvolvido com ❤️ usando Node.js**
