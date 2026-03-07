import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import sharp from "sharp";

/**
 * MetadataEnricher usando Web Scraping totalmente gratuito:
 * - IMDb Suggestion API (API interna pública do IMDb)
 * - TVMaze API para séries (http://api.tvmaze.com/)
 *
 * 100% gratuito, sem necessidade de chaves API!
 */
class MetadataEnricher {
  constructor(config) {
    this.config = config;
    this.imdbSuggestUrl = "https://v3.sg.media-imdb.com/suggestion";
    this.tvmazeBaseUrl = "http://api.tvmaze.com";
  }

  /**
   * Busca metadados de um filme via IMDb Suggestion API
   */
  async getMovieMetadata(movieName, year = null) {
    try {
      // IMDb Suggestion API - API interna pública
      const query = movieName.toLowerCase().replace(/\s+/g, "_");
      const firstChar = query[0];
      const suggestUrl = `${this.imdbSuggestUrl}/${firstChar}/${query}.json`;

      console.log(`🔍 Buscando no IMDb: ${movieName}`);

      const response = await axios.get(suggestUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      let data = response.data;

      // Se a resposta começar com "imdb$", remover isso
      if (typeof data === "string") {
        data = JSON.parse(data.replace(/^imdb\$[^(]*\(/, "").replace(/\)$/, ""));
      }

      if (!data.d || data.d.length === 0) {
        console.warn(`⚠️  Filme não encontrado no IMDb: ${movieName}`);
        return this.getBasicMovieMetadata(movieName, year);
      }

      // Filtrar apenas filmes (qid: "movie") e buscar por ano se fornecido
      let movies = data.d.filter((item) => !item.qid || item.qid === "movie" || item.q === "feature");

      if (year && movies.length > 1) {
        const movieWithYear = movies.find((m) => m.y && m.y == year);
        if (movieWithYear) {
          movies = [movieWithYear];
        }
      }

      if (movies.length === 0) {
        movies = data.d.filter((item) => item.id); // Pegar qualquer resultado com ID
      }

      const movie = movies[0];

      if (!movie) {
        return this.getBasicMovieMetadata(movieName, year);
      }

      // Buscar mais detalhes se possível
      const imdbId = movie.id;
      const detailedData = await this.getIMDbDetails(imdbId);

      return {
        id: imdbId,
        title: movie.l || movieName,
        originalTitle: movie.l || movieName,
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
      };
    } catch (err) {
      console.error("Erro ao buscar no IMDb:", err.message);
      return this.getBasicMovieMetadata(movieName, year);
    }
  }

  /**
   * Tenta buscar detalhes adicionais do IMDb (pode falhar devido a proteções)
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
   * Converte duração ISO 8601 para minutos
   */
  parseDuration(duration) {
    if (!duration) return 0;
    const match = duration.match(/PT(\d+)H?(\d+)?M/);
    if (match) {
      const hours = parseInt(match[1]) || 0;
      const minutes = parseInt(match[2]) || 0;
      return hours * 60 + minutes;
    }
    return 0;
  }

  /**
   * Busca metadados de uma série via IMDb Suggestion API
   */
  async getSeriesMetadata(seriesName) {
    try {
      const query = seriesName.toLowerCase().replace(/\s+/g, "_");
      const firstChar = query[0];
      const suggestUrl = `${this.imdbSuggestUrl}/${firstChar}/${query}.json`;

      console.log(`🔍 Buscando série no IMDb: ${seriesName}`);

      const response = await axios.get(suggestUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      let data = response.data;

      if (typeof data === "string") {
        data = JSON.parse(data.replace(/^imdb\$[^(]*\(/, "").replace(/\)$/, ""));
      }

      if (!data.d || data.d.length === 0) {
        console.warn(`⚠️  Série não encontrada no IMDb, tentando TVMaze...`);
        return await this.getSeriesMetadataFromTVMaze(seriesName);
      }

      // Filtrar apenas séries (qid: "tvSeries" ou q: "TV series")
      let series = data.d.filter((item) => item.qid === "tvSeries" || item.q === "TV series" || item.q === "TV mini series");

      if (series.length === 0) {
        // Se não encontrar série, tentar TVMaze
        return await this.getSeriesMetadataFromTVMaze(seriesName);
      }

      const show = series[0];
      const imdbId = show.id;
      const detailedData = await this.getIMDbDetails(imdbId);

      return {
        id: imdbId,
        name: show.l || seriesName,
        originalName: show.l || seriesName,
        firstAirDate: show.y || null,
        overview: detailedData?.overview || "",
        genres: detailedData?.genres || [],
        rating: detailedData?.rating || 0,
        posterUrl: show.i?.imageUrl || show.i?.[0] || null,
        backdropUrl: show.i?.imageUrl || show.i?.[0] || null,
        numberOfSeasons: null,
        numberOfEpisodes: null,
        status: null,
        imdbId: imdbId,
      };
    } catch (err) {
      console.error("Erro ao buscar série no IMDb:", err.message);
      return await this.getSeriesMetadataFromTVMaze(seriesName);
    }
  }

  /**
   * Fallback: Busca metadados de uma série no TVMaze
   */
  async getSeriesMetadataFromTVMaze(seriesName) {
    try {
      const searchResponse = await axios.get(`${this.tvmazeBaseUrl}/search/shows`, {
        params: { q: seriesName },
      });

      if (!searchResponse.data || searchResponse.data.length === 0) {
        console.warn(`⚠️  Série não encontrada no TVMaze: ${seriesName}`);
        return this.getBasicSeriesMetadata(seriesName);
      }

      const showData = searchResponse.data[0].show;

      return {
        id: showData.id,
        name: showData.name,
        originalName: showData.name,
        firstAirDate: showData.premiered,
        overview: showData.summary ? showData.summary.replace(/<[^>]*>/g, "") : "",
        genres: showData.genres || [],
        rating: showData.rating?.average || 0,
        posterUrl: showData.image?.original || showData.image?.medium || null,
        backdropUrl: showData.image?.original || null,
        numberOfSeasons: null,
        numberOfEpisodes: null,
        status: showData.status,
        network: showData.network?.name || showData.webChannel?.name,
        language: showData.language,
        imdbId: showData.externals?.imdb,
      };
    } catch (err) {
      console.error("Erro ao buscar metadados no TVMaze:", err.message);
      return this.getBasicSeriesMetadata(seriesName);
    }
  }

  /**
   * Busca metadados de um episódio específico no TVMaze
   */
  async getEpisodeMetadata(seriesId, seasonNumber, episodeNumber) {
    try {
      const response = await axios.get(`${this.tvmazeBaseUrl}/shows/${seriesId}/episodebynumber`, {
        params: { season: seasonNumber, number: episodeNumber },
      });

      const episode = response.data;

      return {
        name: episode.name,
        overview: episode.summary ? episode.summary.replace(/<[^>]*>/g, "") : "",
        airDate: episode.airdate,
        episodeNumber: episode.number,
        seasonNumber: episode.season,
        stillUrl: episode.image?.original || episode.image?.medium || null,
        rating: episode.rating?.average || 0,
      };
    } catch (err) {
      console.error("Erro ao buscar metadados do episódio:", err.message);
      return null;
    }
  }

  /**
   * Busca metadados de uma temporada inteira no TVMaze
   */
  async getSeasonMetadata(seriesId, seasonNumber) {
    try {
      const response = await axios.get(`${this.tvmazeBaseUrl}/shows/${seriesId}/episodes`);

      const seasonEpisodes = response.data.filter((ep) => ep.season === seasonNumber);

      if (seasonEpisodes.length === 0) {
        return null;
      }

      return {
        name: `Season ${seasonNumber}`,
        overview: "",
        airDate: seasonEpisodes[0]?.airdate,
        episodes: seasonEpisodes.map((ep) => ({
          episodeNumber: ep.number,
          name: ep.name,
          overview: ep.summary ? ep.summary.replace(/<[^>]*>/g, "") : "",
          airDate: ep.airdate,
          stillUrl: ep.image?.original || ep.image?.medium || null,
        })),
        posterUrl: seasonEpisodes[0]?.image?.original || null,
      };
    } catch (err) {
      console.error("Erro ao buscar metadados da temporada:", err.message);
      return null;
    }
  }

  /**
   * Gera nome padronizado para filme
   */
  getMovieFilename(metadata, quality = "1080p") {
    const title = this.sanitizeFilename(metadata.title);
    const year = metadata.year || "";
    return `${title} (${year}) [${quality}]`;
  }

  /**
   * Gera nome padronizado para episódio
   */
  getEpisodeFilename(seriesMetadata, seasonNumber, episodeNumber, episodeName = null, quality = "1080p") {
    const seriesName = this.sanitizeFilename(seriesMetadata.name);
    const season = String(seasonNumber).padStart(2, "0");
    const episode = String(episodeNumber).padStart(2, "0");

    let filename = `${seriesName} - S${season}E${episode}`;

    if (episodeName) {
      const cleanEpisodeName = this.sanitizeFilename(episodeName);
      filename += ` - ${cleanEpisodeName}`;
    }

    filename += ` [${quality}]`;
    return filename;
  }

  /**
   * Baixa poster/capa de URL direta
   */
  async downloadPoster(posterUrl, destinationPath, filename = "poster.jpg") {
    if (!posterUrl || posterUrl === "N/A") return null;

    try {
      const response = await axios.get(posterUrl, { responseType: "arraybuffer" });

      const fullPath = path.join(destinationPath, filename);

      // Criar diretório se não existir
      if (!fs.existsSync(destinationPath)) {
        fs.mkdirSync(destinationPath, { recursive: true });
      }

      // Salvar imagem original
      fs.writeFileSync(fullPath, response.data);

      // Criar thumbnail também
      const thumbnailPath = path.join(destinationPath, `${path.parse(filename).name}_thumb.jpg`);
      await sharp(response.data).resize(300, 450, { fit: "cover" }).toFile(thumbnailPath);

      console.log(`🖼️  Poster salvo: ${filename}`);
      return fullPath;
    } catch (err) {
      console.error("Erro ao baixar poster:", err.message);
      return null;
    }
  }

  /**
   * Baixa backdrop/fanart de URL direta
   */
  async downloadBackdrop(backdropUrl, destinationPath, filename = "fanart.jpg") {
    if (!backdropUrl || backdropUrl === "N/A") return null;

    try {
      const response = await axios.get(backdropUrl, { responseType: "arraybuffer" });

      const fullPath = path.join(destinationPath, filename);

      // Criar diretório se não existir
      if (!fs.existsSync(destinationPath)) {
        fs.mkdirSync(destinationPath, { recursive: true });
      }

      fs.writeFileSync(fullPath, response.data);

      console.log(`🖼️  Fanart salvo: ${filename}`);
      return fullPath;
    } catch (err) {
      console.error("Erro ao baixar fanart:", err.message);
      return null;
    }
  }

  /**
   * Salva metadados em arquivo NFO (formato Kodi/Plex)
   */
  saveNFO(metadata, destinationPath, type = "movie") {
    try {
      let nfoContent = "";

      if (type === "movie") {
        nfoContent = this.generateMovieNFO(metadata);
      } else if (type === "tvshow") {
        nfoContent = this.generateTVShowNFO(metadata);
      } else if (type === "episode") {
        nfoContent = this.generateEpisodeNFO(metadata);
      }

      const nfoPath = path.join(destinationPath, `${type}.nfo`);
      fs.writeFileSync(nfoPath, nfoContent, "utf8");

      console.log(`📄 Metadados salvos: ${type}.nfo`);
      return nfoPath;
    } catch (err) {
      console.error("Erro ao salvar NFO:", err.message);
      return null;
    }
  }

  /**
   * Gera XML NFO para filme
   */
  generateMovieNFO(metadata) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<movie>
  <title>${this.escapeXml(metadata.title)}</title>
  <originaltitle>${this.escapeXml(metadata.originalTitle || metadata.title)}</originaltitle>
  <year>${metadata.year}</year>
  <plot>${this.escapeXml(metadata.overview || "")}</plot>
  <runtime>${metadata.runtime || 0}</runtime>
  <rating>${metadata.rating || 0}</rating>
  <votes>${metadata.votes || 0}</votes>
  <id>${metadata.id}</id>
  <imdb>${metadata.imdbId || ""}</imdb>
  ${metadata.genres?.map((g) => `<genre>${this.escapeXml(g)}</genre>`).join("\n  ") || ""}
</movie>`;
  }

  /**
   * Gera XML NFO para série
   */
  generateTVShowNFO(metadata) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<tvshow>
  <title>${this.escapeXml(metadata.name)}</title>
  <originaltitle>${this.escapeXml(metadata.originalName || metadata.name)}</originaltitle>
  <plot>${this.escapeXml(metadata.overview || "")}</plot>
  <rating>${metadata.rating || 0}</rating>
  <id>${metadata.id}</id>
  <status>${metadata.status || ""}</status>
  <premiered>${metadata.firstAirDate || ""}</premiered>
  ${metadata.genres?.map((g) => `<genre>${this.escapeXml(g)}</genre>`).join("\n  ") || ""}
</tvshow>`;
  }

  /**
   * Gera XML NFO para episódio
   */
  generateEpisodeNFO(metadata) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails>
  <title>${this.escapeXml(metadata.name || "")}</title>
  <season>${metadata.seasonNumber}</season>
  <episode>${metadata.episodeNumber}</episode>
  <plot>${this.escapeXml(metadata.overview || "")}</plot>
  <rating>${metadata.rating || 0}</rating>
  <aired>${metadata.airDate || ""}</aired>
</episodedetails>`;
  }

  /**
   * Metadados básicos para filme (fallback)
   */
  getBasicMovieMetadata(movieName, year) {
    return {
      id: null,
      title: movieName,
      originalTitle: movieName,
      year: year,
      overview: "",
      genres: [],
      rating: 0,
      posterUrl: null,
      backdropUrl: null,
    };
  }

  /**
   * Metadados básicos para série (fallback)
   */
  getBasicSeriesMetadata(seriesName) {
    return {
      id: null,
      name: seriesName,
      originalName: seriesName,
      overview: "",
      genres: [],
      rating: 0,
      posterUrl: null,
      backdropUrl: null,
    };
  }

  /**
   * Sanitiza nome de arquivo
   */
  sanitizeFilename(name) {
    return name
      .replace(/[<>:"/\\|?*]/g, "_")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Escapa caracteres XML
   */
  escapeXml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }
}

export default MetadataEnricher;
