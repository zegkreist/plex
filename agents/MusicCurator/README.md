# MusicCurator Agent 🎵

Agent responsável por organizar e curar a biblioteca de música do Plex.

## 📋 Funcionalidades

- 🔍 Escaneia automaticamente a biblioteca de música do Plex
- 🎨 **Consolidação de álbuns duplicados usando análise de covers por LLM**
- 🗂️ Organiza faixas e álbuns
- 🏷️ Atualiza e corrige metadados
- 📊 Gera estatísticas da biblioteca
- ✅ Sistema de marcação para álbuns já processados
- ⏰ Execução automática em intervalos configuráveis

## 🎵 Consolidador de Álbuns (Novidade!)

O MusicCurator agora inclui um sistema inteligente de consolidação de álbuns que:

### Como funciona:

1. **Escaneia uma pasta de artista** (estrutura: `music/artista/album/musicas.flac`)
2. **Compara covers visualmente** usando LLM com visão (llama3.2-vision)
3. **Agrupa álbuns similares** (mesmo álbum com nomes diferentes)
4. **Determina o nome correto** usando AllFather + MusicBrainz
5. **Marca álbuns processados** para não reprocessar

### Exemplos de uso:

#### 1. Escanear biblioteca completa

```bash
node examples/scan-music-directory.js /music
```

Lista todos os artistas, álbuns e mostra quais já foram curados.

#### 2. Consolidar álbuns de um artista (modo dry-run)

```bash
node examples/consolidate-albums.js "/music/Pink Floyd"
```

Analisa álbuns duplicados **sem fazer alterações**. Perfeito para testar!

#### 3. Aplicar correções (modo produção)

Edite o script para `dryRun: false` ou use diretamente no código:

```javascript
import { AlbumConsolidator } from "./src/album-consolidator.js";
import { AllFather } from "@plex-agents/allfather";

const allfather = new AllFather();
const consolidator = new AlbumConsolidator(allfather);

const { groups, results } = await consolidator.consolidateArtistAlbums("/music/Pink Floyd", "Pink Floyd", {
  dryRun: false, // Aplica as correções
  skipCurated: true, // Pula álbuns já processados
  similarityThreshold: 0.85, // Threshold de similaridade (0-1)
});
```

### Estrutura esperada:

```
music/
├── Pink Floyd/
│   ├── The Dark Side of the Moon/
│   │   ├── cover.jpg
│   │   ├── 01 - Speak to Me.flac
│   │   └── 02 - Breathe.flac
│   ├── Dark Side Of Moon/  ← Duplicata!
│   │   ├── cover.jpg  ← Mesmo cover
│   │   └── 03 - On the Run.flac
│   └── The Wall/
│       ├── folder.png
│       └── 01 - In the Flesh.flac
```

### Sistema de marcação:

Após processar um álbum, o sistema cria um arquivo `.curated` dentro da pasta:

```json
{
  "curatedAt": "2026-03-05T10:30:00.000Z",
  "metadata": {
    "correctAlbumName": "The Dark Side of the Moon",
    "originalName": "Dark Side Of Moon",
    "groupId": 0,
    "metadata": {
      "artist": "Pink Floyd",
      "album": "The Dark Side of the Moon",
      "year": "1973"
    }
  }
}
```

Álbuns com `.curated` são automaticamente pulados nas próximas execuções (se `skipCurated: true`).

## 🚀 Instalação

### 1. Instalar dependências

```bash
cd agents/MusicCurator
npm install
```

### 2. Instalar modelo de visão (para consolidador de álbuns)

O consolidador de álbuns usa **llama3.2-vision** para comparar covers visualmente:

```bash
ollama pull llama3.2-vision
```

> 💡 **Nota**: Se já tem o AllFather configurado, pode verificar modelos com: `ollama list`

### 3. Configurar variáveis de ambiente

Copie o arquivo de exemplo e configure suas credenciais:

```bash
cp .env.example .env
```

Edite o `.env` e configure:

```bash
PLEX_URL=http://localhost:32400
PLEX_TOKEN=seu-token-aqui
MUSIC_PATH=/music
CURATOR_INTERVAL=3600000
OLLAMA_URL=http://localhost:11434
OLLAMA_DEFAULT_MODEL=deepseek-r1:7b
```

#### Como obter o PLEX_TOKEN:

1. Abra o Plex Web (http://localhost:32400/web)
2. Vá em Settings > Account
3. Pressione `Ctrl + Shift + O` para abrir o console
4. Procure por "Token" ou acesse: Settings > Account > Show Token

Ou acesse diretamente: `http://localhost:32400/web/index.html#!/settings/account`

### 3. Executar o agent

```bash
# Modo produção
npm start

# Modo desenvolvimento (com hot-reload)
npm run dev
```

## 📁 Estrutura do projeto

```
MusicCurator/
├── index.js              # Ponto de entrada do agent
├── src/
│   └── curator.js        # Lógica principal de curadoria
├── package.json          # Dependências e scripts
├── .env.example          # Exemplo de configuração
└── README.md            # Este arquivo
```

## 🔧 Configuração

### Variáveis de ambiente

| Variável           | Descrição                      | Padrão                   |
| ------------------ | ------------------------------ | ------------------------ |
| `PLEX_URL`         | URL do servidor Plex           | `http://localhost:32400` |
| `PLEX_TOKEN`       | Token de autenticação          | -                        |
| `MUSIC_PATH`       | Caminho da biblioteca          | `/music`                 |
| `CURATOR_INTERVAL` | Intervalo entre execuções (ms) | `3600000` (1h)           |

## 🎯 Como funciona

1. **Inicialização**: Conecta ao servidor Plex e valida credenciais
2. **Scan**: Escaneia a biblioteca de música
3. **Organização**: Processa e organiza as faixas
4. **Metadados**: Atualiza informações das músicas
5. **Aguarda**: Espera o intervalo configurado e repete

## 📝 Próximas funcionalidades

- [ ] Detecção de músicas duplicadas
- [ ] Integração com MusicBrainz para metadados
- [ ] Organização automática de arquivos
- [ ] Geração de playlists inteligentes
- [ ] Notificações de novas músicas adicionadas
- [ ] API REST para controle do agent

## 🐛 Troubleshooting

### Erro de conexão com Plex

Certifique-se de que:

- O servidor Plex está rodando
- A URL está correta
- O token é válido

### Agent não encontra a biblioteca

Verifique se existe uma biblioteca do tipo "Music" no seu Plex.

## 📦 Dependências

- **axios**: Cliente HTTP para comunicação com Plex API
- **dotenv**: Gerenciamento de variáveis de ambiente

## 🤝 Contribuindo

Este é o primeiro agent do sistema. Novos agents seguirão estrutura similar.
