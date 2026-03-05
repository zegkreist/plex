import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { AllFather } from "../index.js";

describe("AllFather - Comunicação com Ollama", () => {
  let allfather;

  before(() => {
    // Configuração antes dos testes
    allfather = new AllFather({
      ollamaUrl: "http://localhost:11434",
      model: "deepseek-r1:1.5b",
      temperature: 0.7,
    });
  });

  describe("Inicialização", () => {
    it("deve criar uma instância do AllFather", () => {
      assert.ok(allfather);
      assert.strictEqual(allfather.model, "deepseek-r1:1.5b");
    });

    it("deve ter URL do Ollama configurada", () => {
      assert.strictEqual(allfather.ollamaUrl, "http://localhost:11434");
    });
  });

  describe("Verificação de conexão", () => {
    it("deve verificar se o Ollama está rodando", async () => {
      const isRunning = await allfather.checkConnection();
      assert.strictEqual(typeof isRunning, "boolean");
    });

    it("deve retornar informações do servidor Ollama", async () => {
      const info = await allfather.getServerInfo();
      assert.ok(info);
    });
  });

  describe("Gerenciamento de modelos", () => {
    it("deve listar modelos disponíveis", async () => {
      const models = await allfather.listModels();
      assert.ok(Array.isArray(models));
    });

    it("deve verificar se um modelo está disponível", async () => {
      const hasModel = await allfather.hasModel("deepseek-r1:1.5b");
      assert.strictEqual(typeof hasModel, "boolean");
    });
  });

  describe("Comunicação básica - ask()", () => {
    it("deve fazer uma pergunta simples e receber resposta", async () => {
      const response = await allfather.ask('Responda apenas com "OK"');

      assert.ok(response);
      assert.strictEqual(typeof response, "string");
      assert.ok(response.length > 0);
    });

    it("deve responder a perguntas em português", async () => {
      const response = await allfather.ask("Qual é a capital de Portugal?");

      assert.ok(response);
      assert.match(response.toLowerCase(), /lisboa/);
    });

    it("deve processar números e cálculos", async () => {
      const response = await allfather.ask("Quanto é 2 + 2? Responda apenas com o número.");

      assert.ok(response);
      assert.match(response, /4/);
    });
  });

  describe("Comunicação com contexto - askWithContext()", () => {
    it("deve processar pergunta com contexto adicional", async () => {
      const context = {
        role: "music curator",
        library: "Plex Music Library",
        task: "analyze music metadata",
      };

      const response = await allfather.askWithContext("Qual é o seu papel?", context);

      assert.ok(response);
      assert.strictEqual(typeof response, "string");
    });

    it("deve usar contexto para análise de música", async () => {
      const context = {
        trackName: "Bohemian Rhapsody",
        artist: "Queen",
        year: 1975,
      };

      const response = await allfather.askWithContext("Baseado nos dados fornecidos, qual é o gênero musical desta música? Responda apenas com o gênero.", context);

      assert.ok(response);
      assert.ok(response.length > 0);
    });
  });

  describe("Prompts formatados - askWithPrompt()", () => {
    it("deve processar prompt com template", async () => {
      const prompt = allfather.createPrompt("music-genre-detector", {
        trackName: "Smells Like Teen Spirit",
        artist: "Nirvana",
      });

      const response = await allfather.askWithPrompt(prompt);

      assert.ok(response);
      assert.strictEqual(typeof response, "string");
    });

    it("deve ter templates pré-definidos", () => {
      const templates = allfather.getAvailableTemplates();

      assert.ok(Array.isArray(templates));
      assert.ok(templates.length > 0);
    });
  });

  describe("Análise estruturada - askForJSON()", () => {
    it("deve retornar resposta em formato JSON", async () => {
      const response = await allfather.askForJSON('Analise esta música e retorne apenas JSON com campos: genre, mood, tempo. Música: "Hotel California" by Eagles');

      assert.ok(response);
      assert.strictEqual(typeof response, "object");
    });

    it("deve validar estrutura JSON retornada", async () => {
      const response = await allfather.askForJSON('Retorne JSON com campos: name e value. Name deve ser "test" e value deve ser 123');

      assert.ok(response);
      assert.ok(response.name);
      assert.ok(response.value);
    });
  });

  describe("Batch processing", () => {
    it("deve processar múltiplas perguntas em lote", async () => {
      const questions = ["Capital de Portugal?", "Capital de Brasil?", "Capital de Espanha?"];

      const responses = await allfather.askBatch(questions);

      assert.ok(Array.isArray(responses));
      assert.strictEqual(responses.length, questions.length);
      responses.forEach((response) => {
        assert.strictEqual(typeof response, "string");
        assert.ok(response.length > 0);
      });
    });
  });

  describe("Tratamento de erros", () => {
    it("deve lançar erro se Ollama não estiver disponível", async () => {
      const invalidAllfather = new AllFather({
        ollamaUrl: "http://localhost:99999",
        model: "deepseek-r1:1.5b",
      });

      await assert.rejects(async () => await invalidAllfather.ask("test"), Error);
    });

    it("deve lançar erro se modelo não existir", async () => {
      const invalidModelAllfather = new AllFather({
        ollamaUrl: "http://localhost:11434",
        model: "model-that-does-not-exist",
      });

      await assert.rejects(async () => await invalidModelAllfather.ask("test"), Error);
    });

    it("deve ter timeout configurável", async () => {
      const timeoutAllfather = new AllFather({
        ollamaUrl: "http://localhost:11434",
        model: "deepseek-r1:1.5b",
        timeout: 100, // 100ms - muito curto propositalmente
      });

      // Este teste pode passar ou falhar dependendo da velocidade
      // Mas a configuração de timeout deve existir
      assert.strictEqual(timeoutAllfather.timeout, 100);
    });
  });

  describe("Configurações avançadas", () => {
    it("deve permitir alterar temperatura", () => {
      allfather.setTemperature(0.9);
      assert.strictEqual(allfather.temperature, 0.9);
    });

    it("deve permitir alterar modelo", () => {
      allfather.setModel("llama3.2:3b");
      assert.strictEqual(allfather.model, "llama3.2:3b");

      // Restaura para não afetar outros testes
      allfather.setModel("deepseek-r1:1.5b");
    });

    it("deve ter configurações de retry", () => {
      assert.ok(allfather.maxRetries !== undefined);
    });
  });

  describe("Casos de uso reais - MusicCurator", () => {
    it("deve analisar e sugerir gênero musical", async () => {
      const trackInfo = {
        name: "Enter Sandman",
        artist: "Metallica",
        year: 1991,
      };

      const genre = await allfather.askForJSON(
        `Analise esta música e retorne JSON com: {"genre": "genero", "subgenre": "subgenero"}.
        Música: "${trackInfo.name}" por ${trackInfo.artist} (${trackInfo.year})`,
      );

      assert.ok(genre);
      assert.ok(genre.genre);
      assert.strictEqual(typeof genre.genre, "string");
    });

    it("deve corrigir nome de artista com erros de digitação", async () => {
      const correctedName = await allfather.ask('Corrija este nome de artista se houver erro: "The Beattles". Responda apenas com o nome correto.');

      assert.ok(correctedName);
      assert.match(correctedName, /Beatles/i);
    });

    it("deve identificar mood/sentimento da música", async () => {
      const mood = await allfather.ask('Qual o mood/sentimento desta música? "Hurt" por Johnny Cash. Responda com uma palavra.');

      assert.ok(mood);
      assert.strictEqual(typeof mood, "string");
    });

    it("deve detectar duplicatas de músicas", async () => {
      const tracks = ["Bohemian Rhapsody - Queen", "Bohemian Rapsody - Queen", "Bohemian Rhapsody (Remastered) - Queen"];

      const analysis = await allfather.askForJSON(
        `Analise estas músicas e identifique duplicatas: ${JSON.stringify(tracks)}.
        Retorne JSON com: {"duplicates": [[index1, index2]], "unique": [indices]}`,
      );

      assert.ok(analysis);
      assert.ok(analysis.duplicates || analysis.unique);
    });
  });
});
