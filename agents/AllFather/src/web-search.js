import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Módulo para busca e scraping de conteúdo web
 */
export class WebSearch {
  constructor(config = {}) {
    this.timeout = config.timeout || 10000;
    this.maxContentLength = config.maxContentLength || 5000; // caracteres
  }

  /**
   * Busca no DuckDuckGo (não requer API key)
   */
  async searchDuckDuckGo(query, maxResults = 5) {
    try {
      const response = await axios.get('https://html.duckduckgo.com/html/', {
        params: { q: query },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: this.timeout
      });

      const $ = cheerio.load(response.data);
      const results = [];

      $('.result').slice(0, maxResults).each((i, elem) => {
        const title = $(elem).find('.result__title').text().trim();
        const snippet = $(elem).find('.result__snippet').text().trim();
        const url = $(elem).find('.result__url').attr('href');

        if (title && url) {
          results.push({ title, snippet, url });
        }
      });

      return results;
    } catch (error) {
      console.warn('⚠️  Erro ao buscar no DuckDuckGo:', error.message);
      return [];
    }
  }

  /**
   * Busca simples usando API do DuckDuckGo Instant Answer
   */
  async searchInstantAnswer(query) {
    try {
      const response = await axios.get('https://api.duckduckgo.com/', {
        params: {
          q: query,
          format: 'json',
          no_html: 1,
          skip_disambig: 1
        },
        timeout: this.timeout
      });

      const data = response.data;
      
      return {
        abstract: data.Abstract || '',
        abstractText: data.AbstractText || '',
        abstractSource: data.AbstractSource || '',
        abstractURL: data.AbstractURL || '',
        answer: data.Answer || '',
        definition: data.Definition || '',
        relatedTopics: (data.RelatedTopics || []).slice(0, 5).map(topic => ({
          text: topic.Text || '',
          url: topic.FirstURL || ''
        }))
      };
    } catch (error) {
      console.warn('⚠️  Erro ao buscar resposta instantânea:', error.message);
      return null;
    }
  }

  /**
   * Faz scraping de uma página web
   */
  async fetchWebpage(url, options = {}) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: options.timeout || this.timeout,
        maxContentLength: 1024 * 1024 * 2 // 2MB max
      });

      const $ = cheerio.load(response.data);

      // Remove scripts, styles, etc
      $('script, style, nav, footer, header, iframe, noscript').remove();

      // Extrai conteúdo principal
      let content = '';
      
      if (options.selector) {
        content = $(options.selector).text();
      } else {
        // Tenta encontrar o conteúdo principal
        const mainSelectors = ['article', 'main', '.content', '#content', '.post', 'body'];
        
        for (const selector of mainSelectors) {
          const text = $(selector).text().trim();
          if (text.length > content.length) {
            content = text;
          }
        }
      }

      // Limpa e formata o texto
      content = content
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, '\n')
        .trim();

      // Limita tamanho
      if (content.length > this.maxContentLength) {
        content = content.substring(0, this.maxContentLength) + '...';
      }

      return {
        url,
        title: $('title').text().trim(),
        content,
        length: content.length
      };
    } catch (error) {
      throw new Error(`Erro ao buscar página ${url}: ${error.message}`);
    }
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
      
      const batchPromises = batch.map(url => 
        this.fetchWebpage(url, options).catch(error => ({
          url,
          error: error.message,
          content: ''
        }))
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Pequena pausa entre lotes
      if (i + maxConcurrent < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Extrai texto limpo de HTML
   */
  extractTextFromHTML(html) {
    const $ = cheerio.load(html);
    $('script, style, nav, footer, header').remove();
    
    return $('body').text()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Busca tópicos relacionados no Wikipedia (via DuckDuckGo)
   */
  async searchWikipedia(query) {
    try {
      const results = await this.searchInstantAnswer(query + ' wikipedia');
      
      if (results && results.abstractText) {
        return {
          summary: results.abstractText,
          source: results.abstractSource,
          url: results.abstractURL,
          relatedTopics: results.relatedTopics
        };
      }

      return null;
    } catch (error) {
      console.warn('⚠️  Erro ao buscar Wikipedia:', error.message);
      return null;
    }
  }
}
