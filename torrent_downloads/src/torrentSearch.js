import TorrentSearchApi from "torrent-search-api";
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TorrentSearch {
  constructor() {
    // TorrentSearchApi já é uma instância, não uma classe
    this.api = TorrentSearchApi;
    this.initialized = false;
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      const configPath = path.join(__dirname, "../config.json");
      const configData = fs.readFileSync(configPath, "utf8");
      return JSON.parse(configData);
    } catch (error) {
      console.error("Erro ao carregar config.json:", error.message);
      return { search: { providers: [] } };
    }
  }

  async initialize() {
    if (this.initialized) return;

    // Ativar providers do config.json
    const providers = this.config.search?.providers || [];

    if (providers.length > 0) {
      console.log(`🔍 Ativando ${providers.length} providers:`, providers.join(", "));

      for (const providerName of providers) {
        try {
          this.api.enableProvider(providerName);
        } catch (error) {
          console.warn(`⚠️  Provider ${providerName} não disponível`);
        }
      }
    } else {
      // Fallback: ativar todos os públicos
      console.log("🔍 Ativando todos os providers públicos");
      this.api.enablePublicProviders();
    }

    this.initialized = true;
  }

  /**
   * Busca torrents para filmes
   */
  async searchMovies(movieName, year = null) {
    await this.initialize();

    const query = year ? `${movieName} ${year}` : movieName;
    const torrents = await this.api.search(query, "Movies", 20);

    // Ordenar por seeders
    return this.rankResults(torrents, "movie");
  }

  /**
   * Busca torrents para séries
   */
  async searchSeries(seriesName, season = null, episode = null) {
    await this.initialize();

    let query = seriesName;
    if (season && episode) {
      query += ` S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
    } else if (season) {
      query += ` S${String(season).padStart(2, "0")}`;
    }

    const torrents = await this.api.search(query, "All", 20);
    return this.rankResults(torrents, "series");
  }

  /**
   * Busca torrents para música
   */
  async searchMusic(artist, album = null) {
    await this.initialize();

    const query = album ? `${artist} ${album}` : artist;
    const torrents = await this.api.search(query, "Audio", 20);

    return this.rankResults(torrents, "music");
  }

  /**
   * Busca genérica
   */
  async search(query, category = "All", limit = 10) {
    await this.initialize();

    const torrents = await this.api.search(query, category, limit);
    return torrents;
  }

  /**
   * Obtém o magnet link de um torrent
   */
  async getMagnetLink(torrent) {
    await this.initialize();

    try {
      const magnetLink = await this.api.getMagnet(torrent);
      return magnetLink;
    } catch (error) {
      console.error("Erro ao obter magnet link:", error.message);
      return null;
    }
  }

  /**
   * Baixa o arquivo .torrent como Buffer (fallback quando não há magnet)
   */
  async getTorrentBuffer(torrent) {
    await this.initialize();

    try {
      const buffer = await this.api.downloadTorrent(torrent);
      return buffer;
    } catch (error) {
      console.error("Erro ao baixar arquivo .torrent:", error.message);
      return null;
    }
  }

  /**
   * Rankeia resultados por qualidade
   */
  rankResults(torrents, type) {
    return torrents
      .map((torrent) => {
        let score = 0;

        // Pontuação por seeders (máximo 100 pontos) - PRIORIDADE MÁXIMA
        const seeders = parseInt(torrent.seeds) || 0;
        score += Math.min(seeders / 5, 100); // Aumentado de 50 para 100 pontos

        // Pontuação por tamanho (máximo 30 pontos)
        const sizeScore = this.calculateSizeScore(torrent.size, type);
        score += sizeScore;

        // Pontuação por qualidade (máximo 40 pontos para música lossless, 20 para outros)
        const qualityScore = this.calculateQualityScore(torrent.title, type);
        score += qualityScore;

        return {
          ...torrent,
          score,
          seeders,
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Calcula score baseado no tamanho do arquivo
   */
  calculateSizeScore(sizeStr, type) {
    if (!sizeStr) return 0;

    const size = this.parseSizeToMB(sizeStr);

    if (type === "movie") {
      // Filmes ideais: 1.5GB - 10GB
      if (size >= 1500 && size <= 10000) return 30;
      if (size >= 800 && size < 1500) return 20;
      if (size > 10000 && size <= 15000) return 15;
      return 5;
    } else if (type === "series") {
      // Episódios ideais: 200MB - 2GB
      if (size >= 200 && size <= 2000) return 30;
      if (size >= 100 && size < 200) return 20;
      if (size > 2000 && size <= 4000) return 15;
      return 5;
    } else if (type === "music") {
      // Álbuns FLAC: 200MB - 1GB (lossless é maior)
      if (size >= 200 && size <= 1000) return 30;
      // Álbuns MP3 320: 50MB - 200MB
      if (size >= 50 && size < 200) return 25;
      // Álbuns menores (128/192kbps)
      if (size >= 20 && size < 50) return 15;
      return 10;
    }

    return 10;
  }

  /**
   * Calcula score baseado na qualidade
   */
  calculateQualityScore(title, type) {
    const titleLower = title.toLowerCase();
    let score = 0;

    // Para músicas, priorizar FLAC/Lossless
    if (type === "music") {
      if (titleLower.includes("flac") || titleLower.includes("lossless") || titleLower.includes("hi-res")) {
        score += 40; // PRIORIDADE MÁXIMA para lossless
      } else if (titleLower.includes("320") || titleLower.includes("320kbps")) {
        score += 15;
      } else if (titleLower.includes("256") || titleLower.includes("v0")) {
        score += 10;
      }
      return score;
    }

    // Qualidade de vídeo
    if (titleLower.includes("2160p") || titleLower.includes("4k")) score += 20;
    else if (titleLower.includes("1080p")) score += 15;
    else if (titleLower.includes("720p")) score += 10;
    else if (titleLower.includes("480p")) score += 5;

    // Codec
    if (titleLower.includes("x265") || titleLower.includes("hevc")) score += 5;

    // Áudio de vídeos
    if (titleLower.includes("atmos") || titleLower.includes("truehd")) score += 5;
    else if (titleLower.includes("dts") || titleLower.includes("dd5.1")) score += 3;

    return score;
  }

  /**
   * Converte string de tamanho para MB
   */
  parseSizeToMB(sizeStr) {
    if (!sizeStr) return 0;

    const match = sizeStr.match(/([\d.]+)\s*(GB|MB|KB)/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    if (unit === "GB") return value * 1024;
    if (unit === "MB") return value;
    if (unit === "KB") return value / 1024;

    return 0;
  }
}

export default new TorrentSearch();
