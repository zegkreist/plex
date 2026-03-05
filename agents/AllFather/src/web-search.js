import axios from "axios";
import * as cheerio from "cheerio";

/**
 * Módulo para busca e scraping de conteúdo web
 */
export class WebSearch {
  constructor(config = {}) {
    this.timeout = config.timeout || 10000;
    this.maxContentLength = config.maxContentLength || 5000; // caracteres
  }

  /**
   * Busca no Google (via scraping)
   */
  async searchGoogle(query, maxResults = 5) {
    try {
      const response = await axios.get("https://www.google.com/search", {
        params: {
          q: query,
          hl: "pt-BR", // Resultados em português
        },
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
          "Accept-Encoding": "gzip, deflate",
          DNT: "1",
          Connection: "keep-alive",
          "Upgrade-Insecure-Requests": "1",
        },
        timeout: this.timeout,
      });

      const $ = cheerio.load(response.data);
      const results = [];

      // Tenta diferentes seletores do Google
      $(".g, .Gx5Zad, div[data-sokoban-container]")
        .slice(0, maxResults)
        .each((i, elem) => {
          const $elem = $(elem);

          // Título
          const title = $elem.find("h3").first().text().trim() || $elem.find(".LC20lb").text().trim();

          // Snippet/descrição
          const snippet = $elem.find(".VwiC3b, .lEBKkf, .s3v9rd").first().text().trim() || $elem.find(".st").text().trim();

          // URL
          let url = $elem.find("a").first().attr("href");
          if (url && url.startsWith("/url?q=")) {
            url = url.split("/url?q=")[1].split("&")[0];
            url = decodeURIComponent(url);
          }

          if (title && snippet && url) {
            results.push({
              title,
              snippet,
              url,
              source: "Google",
            });
          }
        });

      return results;
    } catch (error) {
      console.warn("⚠️  Erro ao buscar no Google:", error.message);
      return [];
    }
  }

  /**
   * Busca direta na Wikipedia em português
   */
  async searchWikipedia(query, language = "en") {
    try {
      // Primeiro busca para encontrar o artigo
      const searchResponse = await axios.get(`https://${language}.wikipedia.org/w/api.php`, {
        params: {
          action: "opensearch",
          search: query,
          limit: 1,
          namespace: 0,
          format: "json",
        },
        headers: {
          "User-Agent": "AllFatherBot/1.0 (Educational Project; https://github.com/yourproject)",
        },
        timeout: this.timeout,
      });

      if (!searchResponse.data[1] || searchResponse.data[1].length === 0) {
        return null;
      }

      const title = searchResponse.data[1][0];
      const pageUrl = searchResponse.data[3][0];

      // Busca o conteúdo do artigo
      const contentResponse = await axios.get(`https://${language}.wikipedia.org/w/api.php`, {
        params: {
          action: "query",
          prop: "extracts|info",
          exintro: true,
          explaintext: true,
          inprop: "url",
          titles: title,
          format: "json",
        },
        headers: {
          "User-Agent": "AllFatherBot/1.0 (Educational Project; https://github.com/yourproject)",
        },
        timeout: this.timeout,
      });

      const pages = contentResponse.data.query.pages;
      const pageId = Object.keys(pages)[0];
      const page = pages[pageId];

      if (page.extract) {
        return {
          title: page.title,
          summary: page.extract.substring(0, this.maxContentLength),
          url: page.fullurl || pageUrl,
          source: "Wikipedia",
          language: language,
        };
      }

      return null;
    } catch (error) {
      console.warn("⚠️  Erro ao buscar na Wikipedia:", error.message);
      return null;
    }
  }

  /**
   * Busca em múltiplas fontes (Google + Wikipedia)
   */
  async searchMultipleSources(query, options = {}) {
    const results = {
      query: query,
      google: [],
      wikipedia: null,
      timestamp: new Date().toISOString(),
    };

    // Busca em paralelo
    const [googleResults, wikipediaResult] = await Promise.all([this.searchGoogle(query, options.maxGoogleResults || 5), this.searchWikipedia(query, options.wikiLanguage || "en")]);

    results.google = googleResults;
    results.wikipedia = wikipediaResult;

    return results;
  }

  /**
   * Faz scraping de uma página web
   */
  async fetchWebpage(url, options = {}) {
    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        timeout: options.timeout || this.timeout,
        maxContentLength: 1024 * 1024 * 2, // 2MB max
      });

      const $ = cheerio.load(response.data);

      // Remove scripts, styles, etc
      $("script, style, nav, footer, header, iframe, noscript").remove();

      // Extrai conteúdo principal
      let content = "";

      if (options.selector) {
        content = $(options.selector).text();
      } else {
        // Tenta encontrar o conteúdo principal
        const mainSelectors = ["article", "main", ".content", "#content", ".post", "body"];

        for (const selector of mainSelectors) {
          const text = $(selector).text().trim();
          if (text.length > 100) {
            content = text;
            break;
          }
        }
      }

      // Limpa espaços extras
      content = content.replace(/\s+/g, " ").trim();
      content = content.substring(0, this.maxContentLength);

      return {
        url,
        title: $("title").text().trim(),
        content,
        length: content.length,
      };
    } catch (error) {
      throw new Error(`Erro ao buscar página ${url}: ${error.message}`);
    }
  }

  /**
   * Combina resultados de todas as fontes em um texto formatado
   */
  formatSearchResults(searchResults) {
    // Verifica se searchResults é null ou inválido
    if (!searchResults) {
      return "Nenhum resultado encontrado.";
    }

    // Se for resultado direto da Wikipedia (objeto simples)
    if (searchResults.source === "Wikipedia" && searchResults.title) {
      let formatted = `📚 WIKIPEDIA:\n`;
      formatted += `Título: ${searchResults.title}\n`;
      formatted += `${searchResults.summary}\n`;
      formatted += `Fonte: ${searchResults.url}\n`;
      return formatted;
    }

    // Se for resultado direto do Google (array)
    if (Array.isArray(searchResults)) {
      if (searchResults.length === 0) {
        return "Nenhum resultado encontrado no Google.";
      }
      let formatted = `🔍 GOOGLE (${searchResults.length} resultados):\n\n`;
      searchResults.forEach((result, index) => {
        formatted += `${index + 1}. ${result.title}\n`;
        formatted += `   ${result.snippet}\n`;
        formatted += `   ${result.url}\n\n`;
      });
      return formatted;
    }

    // Formato completo com query (múltiplas fontes)
    let formatted = `Resultados da busca por: "${searchResults.query}"\n\n`;

    // Wikipedia
    if (searchResults.wikipedia) {
      formatted += `📚 WIKIPEDIA:\n`;
      formatted += `Título: ${searchResults.wikipedia.title}\n`;
      formatted += `${searchResults.wikipedia.summary}\n`;
      formatted += `Fonte: ${searchResults.wikipedia.url}\n\n`;
    }

    // Google
    if (searchResults.google && searchResults.google.length > 0) {
      formatted += `🔍 GOOGLE (${searchResults.google.length} resultados):\n\n`;
      searchResults.google.forEach((result, index) => {
        formatted += `${index + 1}. ${result.title}\n`;
        formatted += `   ${result.snippet}\n`;
        formatted += `   ${result.url}\n\n`;
      });
    }

    // Se não há resultados de nenhuma fonte
    if (!searchResults.wikipedia && (!searchResults.google || searchResults.google.length === 0)) {
      return "Nenhum resultado encontrado.";
    }

    return formatted;
  }

  /**
   * Busca e extrai informações de múltiplas URLs
   */
  async fetchMultiplePages(urls, options = {}) {
    const maxConcurrent = options.maxConcurrent || 3;
    const results = [];

    // Processa em lotes
    for (let i = 0; i < urls.length; i += maxConcurrent) {
      const batch = urls.slice(i, i + maxConcurrent);

      const batchPromises = batch.map((url) =>
        this.fetchWebpage(url, options).catch((error) => ({
          url,
          error: error.message,
          content: "",
        })),
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Pequena pausa entre lotes
      if (i + maxConcurrent < urls.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Extrai texto limpo de HTML
   */
  extractTextFromHTML(html) {
    const $ = cheerio.load(html);
    $("script, style, nav, footer, header").remove();

    return $("body").text().replace(/\s+/g, " ").trim();
  }
}
