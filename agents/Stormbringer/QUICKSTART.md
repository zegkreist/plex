# Exemplo de uso rápido do Torrent Download Manager

## Quick Start

### 1. Instalar

```bash
npm install
```

### 2. Baixar um filme

```bash
npm run download
# Escolha: Filme
# Digite: The Matrix
# Ano: 1999
# Selecione o torrent desejado
```

### 3. Baixar música

```bash
npm run download
# Escolha: Música
# Artista: Pink Floyd
# Álbum: The Dark Side of the Moon
# Selecione o torrent desejado
```

### 4. Baixar um episódio específico

```bash
npm run download
# Escolha: Série
# Nome: Breaking Bad
# Temporada: 1
# Episódio: 1
# Selecione o torrent desejado
```

### 5. Rastrear uma série automaticamente

```bash
# Adicionar série ao rastreamento
npm run track-series
# Nome: House of the Dragon
# Temporada atual: 2
# Último episódio: 3

# Verificar novos episódios manualmente
npm run check-series

# OU iniciar monitoramento automático (verificação a cada 6h)
node src/cli.js start-monitor
```

## Exemplos de Comandos Diretos

```bash
# Buscar apenas (sem baixar)
node src/cli.js search

# Listar todas as séries rastreadas
node src/cli.js list-tracked

# Verificar novos episódios
node src/cli.js check-series

# Monitoramento contínuo
node src/cli.js start-monitor
```

## Estrutura de Arquivos após Downloads

```
downloads/
├── filmes/
│   └── The.Matrix.1999.1080p.BluRay.x265.mkv
├── series/
│   ├── Breaking.Bad.S01E01.1080p.mkv
│   └── House.of.the.Dragon.S02E04.1080p.mkv
└── musicas/
    └── Pink Floyd/
        └── The Dark Side of the Moon/
            ├── 01 - Speak to Me.mp3
            ├── 02 - Breathe.mp3
            └── ...
```

## Dicas

### Melhorar Velocidade

- Escolha torrents com mais seeders (número em verde)
- Use VPN se estiver com problemas de conexão

### Qualidade

- 1080p: Boa qualidade, tamanho médio
- 720p: Qualidade OK, arquivo menor
- 4K/2160p: Melhor qualidade, arquivo grande

### Codecs

- x265/HEVC: Melhor compressão, arquivo menor
- x264: Compatibilidade maior

### Audio (Música)

- FLAC: Sem perda de qualidade
- 320kbps MP3: Alta qualidade
- V0: Qualidade variável otimizada
