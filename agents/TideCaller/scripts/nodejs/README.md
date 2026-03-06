# Scripts Node.js - Streamrip Tools

Scripts Node.js para análise e gerenciamento da biblioteca musical do Streamrip.

## 📋 Requisitos

- **Node.js** 16+ (com suporte a ES Modules)
- **npm** (gerenciador de pacotes)

## 🚀 Instalação

As dependências são instaladas automaticamente ao executar o script pela primeira vez, mas você também pode instalar manualmente:

```bash
cd scripts/nodejs
npm install
```

## 📦 Dependências

- `music-metadata` - Biblioteca para ler metadados de arquivos de áudio

## 🎵 analyze_library.mjs

Analisa os metadados das músicas baixadas e gera um JSON com artistas e álbuns.

### Uso direto:

```bash
# Analisar pasta downloads/
node scripts/nodejs/analyze_library.mjs downloads/

# Analisar pasta customizada
node scripts/nodejs/analyze_library.mjs /path/to/music
```

### Uso via wrapper:

```bash
# Mais fácil - usa o script wrapper
./scripts/analyze_library.sh

# Com caminho customizado
./scripts/analyze_library.sh /path/to/music
```

### O que faz:

✅ Escaneia recursivamente todos os arquivos de áudio (FLAC, MP3, M4A, etc)  
✅ Extrai metadados (artista, álbum, título, ano, gênero, número da faixa)  
✅ Organiza por artista → álbum → faixas  
✅ Gera estatísticas completas  
✅ Identifica álbuns com poucas faixas (possivelmente incompletos)  
✅ Salva em `library_analysis.json`

### Saída (library_analysis.json):

```json
{
  "statistics": {
    "total_artists": 50,
    "total_albums": 120,
    "total_tracks": 1500,
    "total_size_gb": 15.5,
    "formats": [".flac", ".mp3"]
  },
  "library": {
    "Nome do Artista": {
      "Nome do Álbum": {
        "track_count": 12,
        "total_size_mb": 450.5,
        "formats": [".flac"],
        "year": "2023",
        "genres": ["Rock"],
        "tracks": [
          {
            "title": "Track 01",
            "track_number": "1",
            "disc_number": "1",
            "file": "01 - Track 01.flac",
            "format": ".flac"
          }
        ]
      }
    }
  }
}
```

### Estatísticas exibidas:

- Total de artistas, álbuns, faixas
- Tamanho total da biblioteca em GB
- Formatos de áudio encontrados
- TOP 10 artistas com mais álbuns
- Álbuns com poucas faixas (< 5)

## 🔧 Desenvolvimento

### Adicionar novos scripts:

1. Crie o arquivo `.mjs` nesta pasta
2. Adicione no `package.json` se precisar de novas dependências
3. Crie um wrapper bash em `scripts/` se necessário
4. Documente aqui

### Instalar nova dependência:

```bash
cd scripts/nodejs
npm install --save nome-da-dependencia
```

## ⚙️ package.json

Scripts disponíveis:

```bash
# Executar análise
npm run analyze

# Instalar dependências
npm run install-deps
```
