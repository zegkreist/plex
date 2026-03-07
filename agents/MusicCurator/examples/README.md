# Exemplos de Uso - MusicCurator

Esta pasta contém scripts de exemplo para demonstrar as funcionalidades do MusicCurator.

## 📝 Scripts Disponíveis

### 1. `scan-music-directory.js` - Escanear Biblioteca

Escaneia um diretório de música e lista todos os artistas, álbuns e estatísticas.

**Uso:**

```bash
node examples/scan-music-directory.js /music
```

**Saída:**

- Lista de artistas e álbuns
- Estatísticas gerais (total de faixas, álbuns curados, covers disponíveis)
- Indicadores visuais: ✓ (curado), 🎨 (tem cover)

---

### 2. `consolidate-albums.js` - Consolidar Álbuns Duplicados

Analisa álbuns de um artista e agrupa duplicatas baseado na similaridade dos covers (usando LLM).

**Uso:**

```bash
node examples/consolidate-albums.js "/music/Pink Floyd"
```

**Modo Dry-Run (padrão):**

- Analisa os álbuns **sem fazer alterações**
- Gera relatório detalhado
- Mostra nome correto de cada grupo

**Modo Produção:**
Edite o arquivo e altere `dryRun: false`, ou use programaticamente:

```javascript
import { AlbumConsolidator } from "./src/album-consolidator.js";

const consolidator = new AlbumConsolidator(allfather);

await consolidator.consolidateArtistAlbums("/music/Pink Floyd", "Pink Floyd", {
  dryRun: false, // Aplica correções
  skipCurated: true, // Pula álbuns já processados
  similarityThreshold: 0.85, // 85% de similaridade
});
```

**Opções:**

- `dryRun` (bool): Modo de simulação sem alterações (padrão: `true`)
- `skipCurated` (bool): Pula álbuns com arquivo `.curated` (padrão: `true`)
- `similarityThreshold` (0-1): Limite de similaridade para agrupar (padrão: `0.85`)

---

### 3. `test-cover-comparison.js` - Testar Comparação de Covers

Compara duas imagens de cover e retorna score de similaridade.

**Uso:**

```bash
node examples/test-cover-comparison.js /path/to/cover1.jpg /path/to/cover2.jpg
```

**Saída:**

- Score de similaridade (0-100%)
- Interpretação do resultado:
  - ≥90%: Alto grau de similaridade
  - 70-89%: Similaridade moderada
  - <70%: Baixa similaridade

**Exemplo:**

```bash
node examples/test-cover-comparison.js \
  "/music/The Beatles/Abbey Road/cover.jpg" \
  "/music/The Beatles/Abbey Rd/cover.jpg"
```

---

### 4. `manage-playlists.js` - Gerenciar Playlists Conhecidas

Gerencia a lista de nomes que são playlists (não álbuns) e devem ser ignorados durante o escaneamento.

**Uso:**

```bash
# Listar playlists conhecidas
node examples/manage-playlists.js list

# Adicionar uma playlist (temporário)
node examples/manage-playlists.js add "Chill Vibes"

# Remover uma playlist
node examples/manage-playlists.js remove "ShroomTrip"

# Verificar se um nome é uma playlist conhecida
node examples/manage-playlists.js check "Viagem light"
```

**Playlists padrão:**

- ShroomTrip
- Viagem light
- Hotline Miami Soundtrack
- Balanço Groove Brasil 70's

**Nota:** Alterações via `add`/`remove` são temporárias. Para tornar permanente, edite:

```javascript
// agents/MusicCurator/src/album-consolidator.js
const KNOWN_PLAYLISTS = ["ShroomTrip", "Viagem light", "Sua Nova Playlist Aqui"];
```

---

## 🎯 Fluxo de Trabalho Recomendado

### Primeira vez:

1. **Escanear biblioteca:**
   ```bash
   node examples/scan-music-directory.js /music
   ```
2. **Analisar um artista (dry-run):**

   ```bash
   node examples/consolidate-albums.js "/music/Pink Floyd"
   ```

3. **Revisar relatório** gerado

4. **Aplicar correções** (dryRun: false)

5. **Re-escanear** para ver resultados

### Manutenção contínua:

```bash
# Processa apenas álbuns novos (não curados)
node examples/consolidate-albums.js "/music/Pink Floyd"
```

Os álbuns já processados são automaticamente pulados.

---

## ⚙️ Requisitos

### Modelos Ollama necessários:

```bash
# Modelo principal (já instalado se usa AllFather)
ollama pull deepseek-r1:7b

# Modelo de visão (para comparação de covers)
ollama pull llama3.2-vision
```

### Verificar modelos instalados:

```bash
ollama list
```

---

## 🔧 Troubleshooting

### Erro: "Modelo de visão não encontrado"

```bash
ollama pull llama3.2-vision
```

### Erro: "Ollama não está rodando"

```bash
ollama serve
```

### Comparação de covers retorna null

Possíveis causas:

- Modelo de visão não instalado
- Imagens corrompidas ou formato não suportado
- Timeout do Ollama (aumente em `.env`)

### Álbum não está sendo consolidado

Verifique:

- Ambos álbuns têm covers?
- Covers são suficientemente similares? (ajuste `similarityThreshold`)
- Álbum já foi curado? (arquivo `.curated` existe?)

---

## 📚 Mais Informações

- [README principal](../README.md)
- [AllFather README](../../AllFather/README.md)
- [Documentação Ollama](https://ollama.ai)
