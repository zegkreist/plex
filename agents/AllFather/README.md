# AllFather 🧙‍♂️

**O pai de todos os agents** - Camada de comunicação com Ollama para inteligência artificial em todos os Plex Agents.

## 🎯 O que é AllFather?

AllFather é uma biblioteca compartilhada que fornece uma interface simples e poderosa para comunicação com Ollama (LLMs locais). Todos os agents do sistema Plex usam o AllFather como dependência para acessar capacidades de IA.

**Por que "AllFather"?**

- É o "pai" que conecta todos os agents
- Centraliza a lógica de comunicação com LLM
- Fornece templates e padrões reutilizáveis
- Torna os agents mais inteligentes

## 🚀 Instalação

### Para usar em um agent:

```bash
cd agents/SeuAgent
npm install ../AllFather
```

Ou adicione ao `package.json`:

```json
{
  "dependencies": {
    "@plex-agents/allfather": "file:../AllFather"
  }
}
```

## 📖 Uso Básico

```javascript
import { AllFather } from "@plex-agents/allfather";

// Criar instância
const allfather = new AllFather({
  ollamaUrl: "http://localhost:11434",
  model: "deepseek-r1:1.5b",
  temperature: 0.7,
  disableReasoning: true, // Respostas diretas, sem "thinking"
});

// Pergunta simples
const response = await allfather.ask("Qual é a capital de Portugal?");
console.log(response); // "Lisboa"

// Habilitar reasoning apenas para uma pergunta específica
const responseWithReasoning = await allfather.ask("Explique física quântica", {
  disableReasoning: false,
});

// Pergunta com contexto
const context = {
  trackName: "Bohemian Rhapsody",
  artist: "Queen",
  year: 1975,
};

const genre = await allfather.askWithContext("Qual o gênero desta música?", context);
console.log(genre); // "Rock Progressivo"
```

## 🎭 Métodos Principais

### `ask(question, options)`

Faz uma pergunta simples ao LLM.

```javascript
const answer = await allfather.ask("O que é Docker?");
```

### `askWithContext(question, context, options)`

Pergunta com contexto adicional.

```javascript
const context = {
  library: "Music",
  totalTracks: 1500,
};

const suggestion = await allfather.askWithContext("Como posso organizar melhor esta biblioteca?", context);
```

### `askForJSON(question, options)`

Solicita resposta em formato JSON estruturado.

```javascript
const metadata = await allfather.askForJSON('Analise "Stairway to Heaven" by Led Zeppelin e retorne JSON com: genre, mood, tempo');

console.log(metadata);
// { genre: "Rock", mood: "Epic", tempo: "Medium" }
```

### `askWithPrompt(prompt, options)`

Usa templates de prompts pré-definidos.

```javascript
const prompt = allfather.createPrompt("music-genre-detector", {
  trackName: "Enter Sandman",
  artist: "Metallica",
});

const genre = await allfather.askWithPrompt(prompt);
```

### `askBatch(questions, options)`

Processa múltiplas perguntas em paralelo.

```javascript
const questions = ['Gênero de "Smells Like Teen Spirit" - Nirvana?', 'Gênero de "Hotel California" - Eagles?', 'Gênero de "Billie Jean" - Michael Jackson?'];

const genres = await allfather.askBatch(questions);
```

## 🎨 Templates de Prompts

AllFather inclui templates prontos para casos de uso comuns:

### Música

- `music-genre-detector` - Detecta gênero musical
- `music-metadata-analyzer` - Analisa metadados completos
- `artist-name-corrector` - Corrige nomes de artistas
- `duplicate-detector` - Detecta músicas duplicadas
- `track-mood-analyzer` - Analisa mood/sentimento
- `album-description-generator` - Gera descrições de álbuns
- `playlist-name-suggester` - Sugere nomes para playlists

### Filmes/Séries

- `movie-genre-classifier` - Classifica gênero de filmes
- `content-rating-suggester` - Sugere classificação etária
- `subtitle-language-detector` - Detecta idioma de legendas

### Usando templates:

```javascript
// Listar templates disponíveis
const templates = allfather.getAvailableTemplates();
console.log(templates);

// Usar template
const prompt = allfather.createPrompt("music-metadata-analyzer", {
  trackName: "Comfortably Numb",
  artist: "Pink Floyd",
  year: 1979,
  album: "The Wall",
});

const metadata = await allfather.askWithPrompt(prompt);
```

### Criar template personalizado:

```javascript
allfather.templates.addTemplate(
  "my-custom-template",
  `Analise: {{item}}
  
  Retorne: {{format}}`,
  ["item", "format"],
);
```

## ⚙️ Configuração

### Opções do construtor:

```javascript
const allfather = new AllFather({
  ollamaUrl: "http://localhost:11434", // URL do Ollama
  model: "deepseek-r1:1.5b", // Modelo a usar
  temperature: 0.7, // Criatividade (0-2)
  timeout: 30000, // Timeout em ms
  maxRetries: 3, // Tentativas em caso de erro
  disableReasoning: true, // Desabilita reasoning do deepseek (padrão: true)
});
```

**Sobre `disableReasoning`:**

- Para modelos `deepseek-r1`, desabilita o processo de "thinking"
- Respostas mais rápidas e diretas
- Padrão: `true` (recomendado para uso em produção)
- Configure como `false` se quiser ver o raciocínio do modelo

### Métodos de configuração:

```javascript
// Alterar temperatura (0 = preciso, 2 = criativo)
allfather.setTemperature(0.9);

// Alterar modelo
allfather.setModel("llama3.2:3b");
```

## 🧪 Testes

Execute os testes:

```bash
npm test
```

Testes com watch mode:

```bash
npm run test:watch
```

## 🔍 Verificações

### Verificar conexão:

```javascript
const isRunning = await allfather.checkConnection();
if (!isRunning) {
  console.error("Ollama não está rodando!");
}
```

### Listar modelos:

```javascript
const models = await allfather.listModels();
console.log("Modelos disponíveis:", models);
```

### Verificar modelo específico:

```javascript
const hasModel = await allfather.hasModel("deepseek-r1:1.5b");
if (!hasModel) {
  console.error("Modelo não encontrado!");
}
```

## 📊 Modelos Recomendados

| Modelo             | Tamanho | Uso              | Performance |
| ------------------ | ------- | ---------------- | ----------- |
| `deepseek-r1:1.5b` | 1GB     | Rápido, geral    | ⭐⭐⭐⭐    |
| `deepseek-r1:7b`   | 4.7GB   | Melhor qualidade | ⭐⭐⭐⭐⭐  |
| `llama3.2:3b`      | 3GB     | Balanceado       | ⭐⭐⭐⭐    |
| `codellama:7b`     | 4GB     | Código           | ⭐⭐⭐⭐⭐  |

## 🎯 Casos de Uso

### MusicCurator Agent

```javascript
import { AllFather } from "@plex-agents/allfather";

class MusicCurator {
  constructor() {
    this.allfather = new AllFather({
      model: "deepseek-r1:1.5b",
      temperature: 0.5, // Mais preciso para metadata
    });
  }

  async analyzeTrack(track) {
    const metadata = await this.allfather.askForJSON(
      `Analise: "${track.name}" por ${track.artist}.
      Retorne JSON com: genre, subgenre, mood, tempo, era`,
    );

    return metadata;
  }

  async correctArtistName(name) {
    const prompt = this.allfather.createPrompt("artist-name-corrector", {
      artistName: name,
    });

    return await this.allfather.askWithPrompt(prompt);
  }

  async detectDuplicates(tracks) {
    const trackList = tracks.map((t) => `${t.name} - ${t.artist}`);

    const prompt = this.allfather.createPrompt("duplicate-detector", {
      tracks: trackList,
    });

    return await this.allfather.askForJSON(prompt);
  }
}
```

### MovieCurator Agent (exemplo futuro)

```javascript
class MovieCurator {
  constructor() {
    this.allfather = new AllFather({
      model: "deepseek-r1:1.5b",
    });
  }

  async classifyMovie(movie) {
    const prompt = this.allfather.createPrompt("movie-genre-classifier", {
      title: movie.title,
      year: movie.year,
      director: movie.director,
    });

    return await this.allfather.askWithPrompt(prompt);
  }
}
```

## 🛡️ Tratamento de Erros

```javascript
try {
  const response = await allfather.ask("Pergunta aqui");
  console.log(response);
} catch (error) {
  if (error.message.includes("ECONNREFUSED")) {
    console.error("Ollama não está rodando");
  } else if (error.message.includes("model")) {
    console.error("Modelo não encontrado");
  } else {
    console.error("Erro:", error.message);
  }
}
```

## 📝 Boas Práticas

1. **Use temperatura adequada:**
   - 0.0-0.3: Tarefas precisas (metadata, correção)
   - 0.4-0.7: Tarefas balanceadas (análise, classificação)
   - 0.8-1.0: Tarefas criativas (descrições, sugestões)

2. **Escolha o modelo certo:**
   - Tarefas rápidas: `deepseek-r1:1.5b`
   - Tarefas complexas: `deepseek-r1:7b` ou `llama3.2:3b`

3. **Use templates quando possível:**
   - Mais consistente
   - Mais fácil de manter
   - Reutilizável

4. **Trate erros apropriadamente:**
   - Verifique conexão antes
   - Use try-catch
   - Implemente fallbacks

5. **Teste com dados reais:**
   - Valide respostas
   - Ajuste prompts conforme necessário

## 🔗 Dependências

- **axios**: Cliente HTTP para comunicação com Ollama

## 📦 Estrutura

```
AllFather/
├── index.js              # Classe principal
├── src/
│   └── templates.js      # Sistema de templates
├── test/
│   └── allfather.test.js # Testes
├── package.json          # Configuração
└── README.md            # Esta documentação
```

## 🤝 Contribuindo

Para adicionar novos templates:

```javascript
allfather.templates.addTemplate(
  "nome-do-template",
  `Seu template aqui com {{variáveis}}`,
  ["campo1", "campo2"], // Campos obrigatórios
);
```

## 📄 Licença

Projeto pessoal para uso próprio.

---

**AllFather** - Porque todo agent precisa de um pai sábio 🧙‍♂️
