/**
 * Templates de prompts para diferentes casos de uso
 */
export class PromptTemplates {
  constructor() {
    this.templates = {
      "music-genre-detector": {
        template: `Você é um especialista em música. Analise a seguinte música e identifique o gênero.

Música: "{{trackName}}" por {{artist}}

Responda apenas com o nome do gênero musical principal.`,
        requiredFields: ["trackName", "artist"],
      },

      "music-metadata-analyzer": {
        template: `Analise os metadados desta música e retorne informações estruturadas em JSON.

Título: {{trackName}}
Artista: {{artist}}
{{#if year}}Ano: {{year}}{{/if}}
{{#if album}}Álbum: {{album}}{{/if}}

Retorne JSON com os campos:
- genre: gênero musical
- subgenre: subgênero (se aplicável)
- mood: humor/sentimento da música
- tempo: andamento (slow/medium/fast)
- era: era musical (ex: 70s, 80s, 90s, etc)

IMPORTANTE: Responda APENAS com JSON válido.`,
        requiredFields: ["trackName", "artist"],
      },

      "artist-name-corrector": {
        template: `Você é um assistente que corrige nomes de artistas.

Nome fornecido: "{{artistName}}"

Se houver erro de digitação ou ortografia, corrija e retorne o nome correto.
Se o nome estiver correto, retorne-o exatamente como está.
Responda APENAS com o nome do artista, sem explicações.`,
        requiredFields: ["artistName"],
      },

      "duplicate-detector": {
        template: `Você é um detector de músicas duplicadas. Analise a lista abaixo e identifique possíveis duplicatas.

Músicas:
{{#each tracks}}
{{@index}}: {{this}}
{{/each}}

Considere duplicatas:
- Nomes muito similares (erros de digitação)
- Mesmo nome com "(Remastered)", "(Live)", etc.
- Mesma música em álbuns diferentes

Retorne JSON com:
- duplicates: array de arrays com índices das músicas duplicadas [[0,1], [2,3]]
- unique: array com índices das músicas únicas

IMPORTANTE: Responda APENAS com JSON válido.`,
        requiredFields: ["tracks"],
      },

      "track-mood-analyzer": {
        template: `Analise o mood/sentimento desta música baseado no título e artista.

Música: "{{trackName}}" por {{artist}}

Responda com UMA palavra que melhor descreva o mood:
Opções: energetic, melancholic, happy, dark, romantic, aggressive, peaceful, nostalgic, epic, mysterious`,
        requiredFields: ["trackName", "artist"],
      },

      "album-description-generator": {
        template: `Gere uma descrição curta (2-3 frases) para este álbum.

Álbum: "{{albumName}}"
Artista: {{artist}}
{{#if year}}Ano: {{year}}{{/if}}
{{#if genre}}Gênero: {{genre}}{{/if}}

Seja informativo e objetivo.`,
        requiredFields: ["albumName", "artist"],
      },

      "playlist-name-suggester": {
        template: `Sugira um nome criativo para uma playlist com estas características:

{{#if mood}}Mood: {{mood}}{{/if}}
{{#if genre}}Gênero: {{genre}}{{/if}}
{{#if era}}Era: {{era}}{{/if}}
{{#if description}}Descrição: {{description}}{{/if}}

Sugira 3 nomes criativos e adequados. Liste um por linha.`,
        requiredFields: [],
      },

      "movie-genre-classifier": {
        template: `Classifique o gênero deste filme baseado no título e ano.

Filme: "{{title}}"
{{#if year}}Ano: {{year}}{{/if}}
{{#if director}}Diretor: {{director}}{{/if}}

Responda apenas com o gênero principal do filme.`,
        requiredFields: ["title"],
      },

      "subtitle-language-detector": {
        template: `Identifique o idioma desta legenda baseado no conteúdo:

{{sample}}

Responda apenas com o código ISO 639-1 do idioma (ex: pt, en, es, fr).`,
        requiredFields: ["sample"],
      },

      "content-rating-suggester": {
        template: `Baseado no título e descrição, sugira uma classificação etária apropriada.

Título: "{{title}}"
{{#if description}}Descrição: {{description}}{{/if}}

Responda com: G, PG, PG-13, R, ou NC-17`,
        requiredFields: ["title"],
      },
    };
  }

  /**
   * Renderiza um template com dados
   */
  render(templateName, data) {
    const template = this.templates[templateName];

    if (!template) {
      throw new Error(`Template '${templateName}' não encontrado`);
    }

    // Valida campos obrigatórios
    for (const field of template.requiredFields) {
      if (!data[field]) {
        throw new Error(`Campo obrigatório '${field}' não fornecido para template '${templateName}'`);
      }
    }

    // Renderiza o template (implementação simples de substituição)
    let rendered = template.template;

    // Substitui variáveis simples {{variable}}
    Object.entries(data).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, "g");
      rendered = rendered.replace(regex, value);
    });

    // Remove condicionais não atendidas {{#if field}}...{{/if}}
    rendered = rendered.replace(/\{\{#if \w+\}\}.*?\{\{\/if\}\}/gs, (match) => {
      const field = match.match(/\{\{#if (\w+)\}\}/)[1];
      if (data[field]) {
        return match.replace(/\{\{#if \w+\}\}/, "").replace(/\{\{\/if\}\}/, "");
      }
      return "";
    });

    // Processa loops {{#each array}}...{{/each}}
    rendered = rendered.replace(/\{\{#each (\w+)\}\}(.*?)\{\{\/each\}\}/gs, (match, arrayName, content) => {
      if (!data[arrayName] || !Array.isArray(data[arrayName])) {
        return "";
      }

      return data[arrayName]
        .map((item, index) => {
          let itemContent = content;
          itemContent = itemContent.replace(/\{\{@index\}\}/g, index);
          itemContent = itemContent.replace(/\{\{this\}\}/g, item);
          return itemContent;
        })
        .join("");
    });

    return rendered.trim();
  }

  /**
   * Lista templates disponíveis
   */
  list() {
    return Object.keys(this.templates);
  }

  /**
   * Adiciona um novo template
   */
  addTemplate(name, template, requiredFields = []) {
    this.templates[name] = {
      template,
      requiredFields,
    };
  }

  /**
   * Obtém informações sobre um template
   */
  getTemplate(name) {
    return this.templates[name];
  }
}
