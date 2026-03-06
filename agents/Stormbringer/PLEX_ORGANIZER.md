# Plex Organizer

Script para organizar automaticamente seus arquivos de filmes e séries seguindo as convenções de nomenclatura do Plex Media Server.

## 📋 Convenções Plex

### Filmes

```
/Movies/
  /Movie Name (Year)/
    Movie Name (Year).ext
    poster.jpg
    movie.nfo
```

### Séries

```
/TV Shows/
  /Show Name (Year)/
    /Season 01/
      Show Name - s01e01 - Episode Title.ext
      Show Name - s01e02 - Episode Title.ext
    /Season 02/
      Show Name - s02e01 - Episode Title.ext
    poster.jpg
    tvshow.nfo
```

Referência oficial: https://support.plex.tv/articles/naming-and-organizing-your-movie-media-files/

## 🚀 Como usar

### 1. Preview (Dry Run)

Veja o que será organizado **sem fazer mudanças**:

```bash
npm run plex:preview
```

Este comando mostra:

- Quais arquivos serão processados
- Onde serão movidos
- Estrutura de pastas que será criada

### 2. Organizar arquivos

Depois de verificar o preview, execute a organização real:

```bash
npm run plex:organize
```

## 📁 Diretórios

### Origem

- **Filmes**: `./downloads/filmes/`
- **Séries**: `./downloads/series/`

### Destino

- **Filmes**: `/home/zegkreist/Documents/Pessoal/plex_server_movie/`
- **Séries**: `/home/zegkreist/Documents/Pessoal/plex_server/tv/`

## 🎯 Formatos reconhecidos

### Filmes

- `Movie Name (2020).mkv`
- `Movie.Name.2020.1080p.BluRay.x264.mkv`
- `Movie Name [2020] 720p.mp4`

### Séries

- `Show.Name.S01E01.Episode.Title.mkv`
- `Show Name - s01e01 - Episode Title.mp4`
- `Show.Name.1x01.720p.mkv`
- `Show Name (2020) S01E01.mkv`

## 📦 O que é copiado

O script copia:

- ✅ Arquivo de vídeo principal
- ✅ Poster (poster.jpg)
- ✅ Fanart/Backdrop (fanart.jpg)
- ✅ Arquivos NFO (movie.nfo, tvshow.nfo)

## ⚙️ Funcionamento

1. **Identificação**: Analisa nomes de arquivos para extrair:
   - Nome do filme/série
   - Ano (se disponível)
   - Temporada e episódio (para séries)
   - Título do episódio (se disponível)

2. **Limpeza**: Remove automaticamente:
   - Tags de qualidade (1080p, 720p, BluRay, etc.)
   - Codecs (x264, x265, HEVC)
   - Grupos de release (YIFY, RARBG, etc.)

3. **Organização**: Cria estrutura Plex:
   - Pastas por filme/série
   - Subpastas de temporada (séries)
   - Nomenclatura padronizada

4. **Preservação**:
   - Mantém arquivos originais (copia, não move)
   - Pula arquivos já existentes
   - Copia metadados extras

## 📝 Exemplos

### Antes (Downloads)

```
downloads/
  filmes/
    Inception.2010.1080p.BluRay.x264-YIFY/
      Inception.2010.1080p.BluRay.x264-YIFY.mkv
      poster.jpg
  series/
    Breaking.Bad.S01.Complete/
      Breaking.Bad.S01E01.720p.mkv
      Breaking.Bad.S01E02.720p.mkv
```

### Depois (Plex Server)

```
plex_server_movie/
  Inception (2010)/
    Inception (2010).mkv
    poster.jpg
    movie.nfo

plex_server/tv/
  Breaking Bad/
    Season 01/
      Breaking Bad - s01e01.mkv
      Breaking Bad - s01e02.mkv
    poster.jpg
    tvshow.nfo
```

## 🔧 Personalização

Para alterar diretórios de destino, edite `src/plexOrganizer.js`:

```javascript
this.destMovies = "/seu/caminho/filmes";
this.destSeries = "/seu/caminho/series";
```

## ⚠️ Notas importantes

- **Backups**: Recomendado fazer backup antes de organizar
- **Espaço em disco**: O script copia (não move), certifique-se de ter espaço
- **Arquivos existentes**: Arquivos duplicados são pulados automaticamente
- **Permissões**: Certifique-se de ter permissões de escrita nos diretórios de destino

## 🐛 Troubleshooting

### "Pasta não encontrada"

- Verifique se os diretórios de origem existem
- Baixe alguns torrents primeiro

### "Nenhum arquivo processado"

- Verifique o formato dos nomes de arquivo
- Use `npm run plex:preview` para ver o que foi identificado

### "Erro de permissão"

- Verifique permissões das pastas de destino
- Pode precisar executar com `sudo` (não recomendado)

## 📚 Recursos

- [Guia oficial Plex - Filmes](https://support.plex.tv/articles/naming-and-organizing-your-movie-media-files/)
- [Guia oficial Plex - Séries](https://support.plex.tv/articles/naming-and-organizing-your-tv-show-files/)
