import axios from "axios";
import * as cheerio from "cheerio";

/**
 * Módulo para busca e scraping de conteúdo web
 */
export class WebSearch {
  constructor(config = {}) {
    this.timeout = config.timeout || 10000;
    this.maxContentLength = config.maxContentLength || 5000; // caracteres
    this.imdbSuggestUrl = "https://v3.sg.media-imdb.com/suggestion";
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
   * Busca metadados de música via MusicBrainz
   * @param {string} songTitle - Título da música
   * @param {string} artist - Nome do artista (opcional)
   * @returns {Promise<Object|null>} Metadados da música
   */
  async searchMusicMetadata(songTitle, artist = null) {
    try {
      const queryParts = [`recording:"${songTitle}"`];
      if (artist) {
        queryParts.push(`artist:"${artist}"`);
      }

      const response = await axios.get("https://musicbrainz.org/ws/2/recording", {
        params: {
          query: queryParts.join(" AND "),
          fmt: "json",
          limit: 5,
        },
        headers: {
          "User-Agent": "AllFather/1.0 (plex_server; contact: local@localhost)",
        },
        timeout: this.timeout,
      });

      const recordings = response.data?.recordings || [];
      let candidateRecordings = recordings;

      if (candidateRecordings.length === 0) {
        const looseTerm = [songTitle, artist].filter(Boolean).join(" ").trim();
        if (!looseTerm) {
          return null;
        }

        const looseResponse = await axios.get("https://musicbrainz.org/ws/2/recording", {
          params: {
            query: looseTerm,
            fmt: "json",
            limit: 10,
          },
          headers: {
            "User-Agent": "AllFather/1.0 (plex_server; contact: local@localhost)",
          },
          timeout: this.timeout,
        });

        candidateRecordings = looseResponse.data?.recordings || [];
      }

      if (candidateRecordings.length === 0) {
        return null;
      }

      const normalizedArtist = artist ? artist.toLowerCase() : null;
      const filteredCandidates = candidateRecordings
        .map((item) => {
          const titleScore = this._tokenSimilarity(songTitle, item.title || "");
          const artistNames = (item["artist-credit"] || []).map((credit) => credit.name || "").join(" ");
          const artistScore = normalizedArtist ? this._tokenSimilarity(artist, artistNames) : 1;
          const mbScore = Number(item.score || 0) / 100;
          const combinedScore = titleScore * 0.55 + artistScore * 0.35 + mbScore * 0.1;
          return { item, titleScore, artistScore, combinedScore };
        })
        .filter((entry) => entry.titleScore >= 0.5 && entry.artistScore >= 0.45)
        .sort((a, b) => b.combinedScore - a.combinedScore);

      if (filteredCandidates.length === 0) {
        return null;
      }

      let selected = filteredCandidates[0].item;

      const details = await this.getMusicBrainzRecordingDetails(selected.id);
      const recording = details || selected;

      const artistName = (recording["artist-credit"] || selected["artist-credit"] || [])
        .map((credit) => credit.name)
        .filter(Boolean)
        .join(", ");

      const release = this._pickBestMusicRelease(recording.releases || selected.releases || []);
      const releaseDate = recording["first-release-date"] || selected["first-release-date"] || release?.date || null;
      const year = releaseDate ? releaseDate.slice(0, 4) : null;
      const genres = (recording.genres || []).slice(0, 3).map((item) => item.name);
      const tags = (recording.tags || selected.tags || []).slice(0, 3).map((tag) => tag.name);

      return {
        title: selected.title || songTitle,
        artist: artistName || artist || null,
        album: release?.title || null,
        year,
        genre: genres.length > 0 ? genres.join(", ") : tags.length > 0 ? tags.join(", ") : null,
        duration: this._formatDurationFromMs(recording.length || selected.length),
        musicBrainzId: selected.id || null,
        releaseId: release?.id || null,
        coverArtUrl: this.getCoverArtUrl(release?.id),
        score: selected.score ?? null,
        source: "MusicBrainz",
      };
    } catch (error) {
      console.warn("⚠️  Erro ao buscar música no MusicBrainz:", error.message);
      return null;
    }
  }

  /**
   * Retorna múltiplos candidatos de música no MusicBrainz para desambiguação por LLM
   * @param {string} songTitle - Título da música
   * @param {string} artist - Artista (opcional)
   * @param {number} limit - Limite de candidatos
   * @returns {Promise<Array>} Lista de candidatos
   */
  async searchMusicCandidates(songTitle, artist = null, limit = 8) {
    try {
      const queryParts = [`recording:"${songTitle}"`];
      if (artist) {
        queryParts.push(`artist:"${artist}"`);
      }

      const response = await axios.get("https://musicbrainz.org/ws/2/recording", {
        params: {
          query: queryParts.join(" AND "),
          fmt: "json",
          limit,
        },
        headers: {
          "User-Agent": "AllFather/1.0 (plex_server; contact: local@localhost)",
        },
        timeout: this.timeout,
      });

      let candidateRecordings = response.data?.recordings || [];

      if (candidateRecordings.length === 0) {
        const looseTerm = [songTitle, artist].filter(Boolean).join(" ").trim();
        if (!looseTerm) {
          return [];
        }

        const looseResponse = await axios.get("https://musicbrainz.org/ws/2/recording", {
          params: {
            query: looseTerm,
            fmt: "json",
            limit,
          },
          headers: {
            "User-Agent": "AllFather/1.0 (plex_server; contact: local@localhost)",
          },
          timeout: this.timeout,
        });

        candidateRecordings = looseResponse.data?.recordings || [];
      }

      if (candidateRecordings.length === 0) {
        return [];
      }

      const normalizedArtist = artist ? artist.toLowerCase() : null;
      const filteredCandidates = candidateRecordings
        .map((item) => {
          const titleScore = this._tokenSimilarity(songTitle, item.title || "");
          const artistNames = (item["artist-credit"] || []).map((credit) => credit.name || "").join(" ");
          const artistScore = normalizedArtist ? this._tokenSimilarity(artist, artistNames) : 1;
          const mbScore = Number(item.score || 0) / 100;
          const combinedScore = titleScore * 0.55 + artistScore * 0.35 + mbScore * 0.1;
          return { item, titleScore, artistScore, combinedScore };
        })
        .filter((entry) => entry.titleScore >= 0.45 && entry.artistScore >= 0.4)
        .sort((a, b) => b.combinedScore - a.combinedScore)
        .slice(0, limit);

      const mapped = filteredCandidates.map(({ item, combinedScore }) => {
        const artistName = (item["artist-credit"] || [])
          .map((credit) => credit.name)
          .filter(Boolean)
          .join(", ");
        const release = this._pickBestMusicRelease(item.releases || []);
        const releaseDate = item["first-release-date"] || release?.date || null;
        const year = releaseDate ? releaseDate.slice(0, 4) : null;

        return {
          title: item.title || null,
          artist: artistName || null,
          album: release?.title || null,
          year,
          duration: this._formatDurationFromMs(item.length),
          musicBrainzId: item.id || null,
          releaseId: release?.id || null,
          coverArtUrl: this.getCoverArtUrl(release?.id),
          score: item.score ?? null,
          matchScore: Number(combinedScore.toFixed(3)),
          source: "MusicBrainz",
        };
      });

      return mapped;
    } catch (error) {
      console.warn("⚠️  Erro ao buscar candidatos no MusicBrainz:", error.message);
      return [];
    }
  }

  async searchMusicITunes(songTitle, artist = null) {
    try {
      const term = artist ? `${songTitle} ${artist}` : songTitle;
      const response = await axios.get("https://itunes.apple.com/search", {
        params: {
          term,
          media: "music",
          entity: "song",
          limit: 10,
          country: "US",
        },
        timeout: this.timeout,
      });

      const results = response.data?.results || [];
      if (results.length === 0) {
        return null;
      }

      const normalizedTitle = songTitle.toLowerCase();
      const normalizedArtist = artist ? artist.toLowerCase() : null;

      const exact = results.find((track) => {
        const trackName = (track.trackName || "").toLowerCase();
        const artistName = (track.artistName || "").toLowerCase();
        const titleMatch = trackName.includes(normalizedTitle);
        const artistMatch = normalizedArtist ? artistName.includes(normalizedArtist) : true;
        return titleMatch && artistMatch;
      });

      const selected = exact || results[0];

      return {
        title: selected.trackName || songTitle,
        artist: selected.artistName || artist || null,
        album: selected.collectionName || null,
        year: selected.releaseDate ? String(selected.releaseDate).slice(0, 4) : null,
        genre: selected.primaryGenreName || null,
        duration: this._formatDurationFromMs(selected.trackTimeMillis),
        musicBrainzId: null,
        releaseId: null,
        score: null,
        source: "iTunes Search API",
        trackViewUrl: selected.trackViewUrl || null,
      };
    } catch {
      return null;
    }
  }

  /**
   * Busca informações de filme/série via IMDb Suggestion API
   * API pública do IMDb, não requer chave de API
   * @param {string} title - Título do filme ou série
   * @param {string} year - Ano (opcional, melhora precisão)
   * @returns {Promise<Object|null>} Informações do IMDB
   */
  async searchIMDB(title, year = null) {
    try {
      // IMDb Suggestion API - API interna pública
      const query = title.toLowerCase().replace(/\s+/g, "_");
      const firstChar = query[0];
      const suggestUrl = `${this.imdbSuggestUrl}/${firstChar}/${query}.json`;

      console.log(`🔍 Buscando no IMDb: ${title}`);

      const response = await axios.get(suggestUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        timeout: this.timeout,
      });

      let data = response.data;

      // Se a resposta começar com "imdb$", remover isso
      if (typeof data === "string") {
        data = JSON.parse(data.replace(/^imdb\$[^(]*\(/, "").replace(/\)$/, ""));
      }

      if (!data.d || data.d.length === 0) {
        console.warn(`⚠️  Filme não encontrado no IMDb: ${title}`);
        return this.getBasicMovieMetadata(title, year);
      }

      // Filtrar resultados válidos (excluir spotlights e IDs inválidos)
      let validResults = data.d.filter((item) => {
        // Deve ter um ID válido começando com "tt"
        if (!item.id || !item.id.startsWith("tt")) return false;
        // Não pode ser um nome de pessoa (qid: "name")
        if (item.qid === "name") return false;
        return true;
      });

      if (validResults.length === 0) {
        console.warn(`⚠️  Nenhum resultado válido encontrado para: ${title}`);
        return this.getBasicMovieMetadata(title, year);
      }

      // Filtrar por tipo: filmes, séries, etc
      let filtered = validResults.filter((item) => item.q === "feature" || item.q === "TV series" || item.q === "TV mini-series" || item.qid === "movie" || item.qid === "tvSeries" || item.qid === "tvMiniSeries");

      // Se não encontrou com filtro de tipo, usar todos válidos
      if (filtered.length === 0) {
        filtered = validResults;
      }

      // Buscar por ano se fornecido
      if (year && filtered.length > 1) {
        const withYear = filtered.find((m) => m.y && m.y == year);
        if (withYear) {
          filtered = [withYear];
        }
      }

      const movie = filtered[0];

      if (!movie) {
        return this.getBasicMovieMetadata(title, year);
      }

      // Buscar mais detalhes se possível
      const imdbId = movie.id;
      const detailedData = await this.getIMDbDetails(imdbId);

      return {
        id: imdbId,
        title: movie.l || title,
        originalTitle: movie.l || title,
        year: movie.y || year,
        overview: detailedData?.overview || "",
        genres: detailedData?.genres || [],
        rating: detailedData?.rating || 0,
        votes: detailedData?.votes || 0,
        posterUrl: movie.i?.imageUrl || movie.i?.[0] || null,
        backdropUrl: movie.i?.imageUrl || movie.i?.[0] || null,
        runtime: detailedData?.runtime || 0,
        imdbId: imdbId,
        director: detailedData?.director || "",
        actors: movie.s || "",
        url: `https://www.imdb.com/title/${imdbId}/`,
        source: "IMDb Suggestion API",
      };
    } catch (err) {
      console.error("Erro ao buscar no IMDb:", err.message);
      return this.getBasicMovieMetadata(title, year);
    }
  }

  /**
   * Tenta buscar detalhes adicionais do IMDb (pode falhar devido a proteções)
   * @param {string} imdbId - ID do IMDb (ex: tt1375666)
   * @returns {Promise<Object|null>} Detalhes adicionais ou null
   */
  async getIMDbDetails(imdbId) {
    try {
      // Tentar buscar da página do título
      const url = `https://www.imdb.com/title/${imdbId}/`;
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
        timeout: 5000,
      });

      if (response.status !== 200 || !response.data) {
        return null;
      }

      const $ = cheerio.load(response.data);

      // Tentar extrair JSON-LD
      const jsonLd = $('script[type="application/ld+json"]').html();
      if (jsonLd) {
        const data = JSON.parse(jsonLd);
        return {
          overview: data.description || "",
          genres: data.genre || [],
          rating: data.aggregateRating?.ratingValue || 0,
          votes: data.aggregateRating?.ratingCount || 0,
          runtime: this.parseDuration(data.duration) || 0,
          director: data.director?.[0]?.name || "",
        };
      }

      return null;
    } catch (err) {
      // Se falhar, retornar null (não é crítico)
      return null;
    }
  }

  /**
   * Converte duração ISO 8601 (PT1H30M) para minutos
   * @param {string} duration - Duração no formato ISO 8601
   * @returns {number} Duração em minutos
   */
  parseDuration(duration) {
    if (!duration) return 0;
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || 0);
    const minutes = parseInt(match[2] || 0);
    return hours * 60 + minutes;
  }

  _formatDurationFromMs(milliseconds) {
    if (!milliseconds || Number.isNaN(milliseconds)) {
      return null;
    }
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  getCoverArtUrl(releaseId) {
    if (!releaseId) {
      return null;
    }
    return `https://coverartarchive.org/release/${releaseId}/front-250`;
  }

  async rankCandidatesByCoverImage(inputCoverUrl, candidates = []) {
    if (!inputCoverUrl || !Array.isArray(candidates) || candidates.length === 0) {
      return candidates;
    }

    const ranked = [];
    for (const candidate of candidates) {
      if (!candidate.coverArtUrl) {
        ranked.push({ ...candidate, coverSimilarity: null });
        continue;
      }

      const similarity = await this.compareImageSimilarity(inputCoverUrl, candidate.coverArtUrl);
      ranked.push({ ...candidate, coverSimilarity: similarity });
    }

    ranked.sort((left, right) => {
      const a = left.coverSimilarity ?? -1;
      const b = right.coverSimilarity ?? -1;
      return b - a;
    });

    return ranked;
  }

  async compareImageSimilarity(leftImageUrl, rightImageUrl) {
    try {
      const [leftBuffer, rightBuffer] = await Promise.all([this.fetchImageBuffer(leftImageUrl), this.fetchImageBuffer(rightImageUrl)]);

      if (!leftBuffer || !rightBuffer) {
        return null;
      }

      const { Jimp } = await import("jimp");
      const [leftImage, rightImage] = await Promise.all([Jimp.read(leftBuffer), Jimp.read(rightBuffer)]);

      const leftHash = leftImage.hash();
      const rightHash = rightImage.hash();

      const distance = Jimp.compareHashes(leftHash, rightHash);
      const similarity = Math.max(0, 1 - distance);
      return Number(similarity.toFixed(4));
    } catch {
      return null;
    }
  }

  async fetchImageBuffer(imageUrl) {
    try {
      const response = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: this.timeout,
        headers: {
          "User-Agent": "AllFather/1.0 (plex_server; contact: local@localhost)",
        },
      });

      return Buffer.from(response.data);
    } catch {
      return null;
    }
  }

  async getMusicBrainzRecordingDetails(recordingId) {
    try {
      const response = await axios.get(`https://musicbrainz.org/ws/2/recording/${recordingId}`, {
        params: {
          inc: "releases+genres+tags+artist-credits",
          fmt: "json",
        },
        headers: {
          "User-Agent": "AllFather/1.0 (plex_server; contact: local@localhost)",
        },
        timeout: this.timeout,
      });
      return response.data || null;
    } catch {
      return null;
    }
  }

  _pickBestMusicRelease(releases = []) {
    if (!releases || releases.length === 0) {
      return null;
    }

    const official = releases.filter((release) => release.status === "Official");
    const pool = official.length > 0 ? official : releases;

    const dated = pool.filter((release) => Boolean(release.date));
    if (dated.length > 0) {
      dated.sort((a, b) => a.date.localeCompare(b.date));
      return dated[0];
    }

    return pool[0];
  }

  _tokenSimilarity(left, right) {
    const normalize = (value) =>
      String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const leftTokens = normalize(left)
      .split(" ")
      .filter((token) => token.length > 2);
    const rightTokens = new Set(
      normalize(right)
        .split(" ")
        .filter((token) => token.length > 2),
    );

    if (leftTokens.length === 0) {
      return 0;
    }

    const matches = leftTokens.filter((token) => rightTokens.has(token)).length;
    return matches / leftTokens.length;
  }

  /**
   * Retorna metadados básicos quando a busca falha
   * @param {string} title - Título do filme
   * @param {string} year - Ano do filme
   * @returns {Object} Metadados básicos
   */
  getBasicMovieMetadata(title, year) {
    return {
      id: null,
      title: title,
      originalTitle: title,
      year: year || null,
      overview: "",
      genres: [],
      rating: 0,
      votes: 0,
      posterUrl: null,
      backdropUrl: null,
      runtime: 0,
      imdbId: null,
      director: "",
      actors: "",
      url: null,
      source: "Fallback",
    };
  }

  /**
   * Busca informações de filme/série usando apenas IMDB
   * @param {string} title - Título do filme ou série
   * @returns {Promise<Object>} Objeto com informações do IMDB
   */
  async searchMovieOrSeries(title) {
    const results = {
      query: title,
      wikipedia: null,
      imdb: null,
      timestamp: new Date().toISOString(),
    };

    results.imdb = await this.searchIMDB(title);

    return results;
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

    // Se for resultado direto do IMDB (objeto simples)
    if (searchResults.source === "IMDB" && searchResults.title) {
      let formatted = `🎬 IMDB:\n`;
      formatted += `Título: ${searchResults.title}\n`;
      if (searchResults.year) formatted += `Ano: ${searchResults.year}\n`;
      if (searchResults.type) formatted += `Tipo: ${searchResults.type}\n`;
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

    // IMDB (para filmes/séries)
    if (searchResults.imdb) {
      formatted += `🎬 IMDB:\n`;
      formatted += `Título: ${searchResults.imdb.title}\n`;
      if (searchResults.imdb.year) formatted += `Ano: ${searchResults.imdb.year}\n`;
      if (searchResults.imdb.type) formatted += `Tipo: ${searchResults.imdb.type}\n`;
      formatted += `Fonte: ${searchResults.imdb.url}\n\n`;
    }

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
    if (!searchResults.wikipedia && !searchResults.imdb && (!searchResults.google || searchResults.google.length === 0)) {
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
