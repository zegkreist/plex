import axios from "axios";
import { PromptTemplates } from "./src/templates.js";

/**
 * AllFather - Camada de comunicação com Ollama para todos os agents
 * O pai de todos os agents, provendo acesso à inteligência do LLM
 */
export class AllFather {
  constructor(config = {}) {
    this.ollamaUrl = config.ollamaUrl || process.env.OLLAMA_URL || "http://localhost:11434";
    this.model = config.model || process.env.OLLAMA_DEFAULT_MODEL || "deepseek-r1:1.5b";
    this.temperature = config.temperature ?? 0.7;
    this.timeout = config.timeout || 30000; // 30 segundos
    this.maxRetries = config.maxRetries ?? 3;
    this.disableReasoning = config.disableReasoning ?? true; // Desabilita reasoning por padrão
    this.templates = new PromptTemplates();

    this.axiosInstance = axios.create({
      baseURL: this.ollamaUrl,
      timeout: this.timeout,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Verifica se o Ollama está rodando
   */
  async checkConnection() {
    try {
      const response = await this.axiosInstance.get("/");
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Obtém informações do servidor Ollama
   */
  async getServerInfo() {
    try {
      const response = await this.axiosInstance.get("/api/tags");
      return response.data;
    } catch (error) {
      throw new Error(`Falha ao obter informações do servidor: ${error.message}`);
    }
  }

  /**
   * Lista modelos disponíveis
   */
  async listModels() {
    try {
      const response = await this.axiosInstance.get("/api/tags");
      return response.data.models || [];
    } catch (error) {
      throw new Error(`Falha ao listar modelos: ${error.message}`);
    }
  }

  /**
   * Verifica se um modelo específico está disponível
   */
  async hasModel(modelName) {
    try {
      const models = await this.listModels();
      return models.some((m) => m.name === modelName || m.name.startsWith(modelName));
    } catch (error) {
      return false;
    }
  }

  /**
   * Método principal: faz uma pergunta ao LLM
   */
  async ask(question, options = {}) {
    // Prepara o prompt, adicionando instrução para desabilitar reasoning se necessário
    let finalPrompt = question;
    const disableReasoning = options.disableReasoning ?? this.disableReasoning;

    // Se reasoning está desabilitado e é um modelo deepseek, adiciona instrução
    if (disableReasoning && (this.model.includes("deepseek") || (options.model && options.model.includes("deepseek")))) {
      finalPrompt = `You must respond directly without showing your thinking process. Do not use <think> tags or show reasoning. Just provide the final answer immediately.\n\n${question}`;
    }

    const params = {
      model: options.model || this.model,
      prompt: finalPrompt,
      stream: false,
      options: {
        temperature: options.temperature ?? this.temperature,
        num_predict: options.maxTokens || 500,
      },
    };

    let lastError;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await this.axiosInstance.post("/api/generate", params);

        if (response.data && response.data.response) {
          return response.data.response.trim();
        }

        throw new Error("Resposta inválida do Ollama");
      } catch (error) {
        lastError = error;

        if (attempt < this.maxRetries - 1) {
          // Aguarda antes de tentar novamente (exponential backoff)
          await this._sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw new Error(`Falha ao comunicar com Ollama após ${this.maxRetries} tentativas: ${lastError.message}`);
  }

  /**
   * Pergunta com contexto adicional
   */
  async askWithContext(question, context, options = {}) {
    let contextString = "";

    if (typeof context === "object") {
      contextString = Object.entries(context)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n");
    } else {
      contextString = String(context);
    }

    const fullPrompt = `Contexto:\n${contextString}\n\nPergunta: ${question}`;

    return this.ask(fullPrompt, options);
  }

  /**
   * Cria um prompt usando templates predefinidos
   */
  createPrompt(templateName, data) {
    return this.templates.render(templateName, data);
  }

  /**
   * Pergunta usando template de prompt
   */
  async askWithPrompt(prompt, options = {}) {
    if (typeof prompt === "string") {
      return this.ask(prompt, options);
    }

    // Se for um objeto de template
    if (prompt.template && prompt.data) {
      const renderedPrompt = this.templates.render(prompt.template, prompt.data);
      return this.ask(renderedPrompt, options);
    }

    throw new Error("Prompt inválido");
  }

  /**
   * Obtém templates disponíveis
   */
  getAvailableTemplates() {
    return this.templates.list();
  }

  /**
   * Pede resposta em formato JSON
   */
  async askForJSON(question, options = {}) {
    const jsonPrompt = `${question}\n\nIMPORTANTE: Responda APENAS com JSON válido, sem texto adicional antes ou depois.`;

    const response = await this.ask(jsonPrompt, {
      ...options,
      temperature: options.temperature ?? 0.3, // Temperatura mais baixa para JSON
    });

    try {
      // Tenta extrair JSON da resposta
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Tenta parsear a resposta diretamente
      return JSON.parse(response);
    } catch (error) {
      throw new Error(`Falha ao parsear JSON da resposta: ${response}`);
    }
  }

  /**
   * Processa várias perguntas em lote
   */
  async askBatch(questions, options = {}) {
    const promises = questions.map((q) => this.ask(q, options));
    return Promise.all(promises);
  }

  /**
   * Altera a temperatura (criatividade)
   */
  setTemperature(temperature) {
    if (temperature < 0 || temperature > 2) {
      throw new Error("Temperatura deve estar entre 0 e 2");
    }
    this.temperature = temperature;
  }

  /**
   * Altera o modelo
   */
  setModel(model) {
    this.model = model;
  }

  /**
   * Função auxiliar para aguardar
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Exporta também como default
export default AllFather;
