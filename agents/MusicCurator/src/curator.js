import axios from "axios";
import { AllFather } from "@plex-agents/allfather";

/**
 * Classe responsável pela curadoria de música
 */
export class MusicCurator {
  constructor() {
    this.plexUrl = process.env.PLEX_URL || "http://localhost:32400";
    this.plexToken = process.env.PLEX_TOKEN || "";
    this.musicLibraryPath = process.env.MUSIC_PATH || "/music";
    this.tracks = [];

    // Inicializa AllFather para inteligência artificial
    this.allfather = new AllFather({
      ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
      model: process.env.OLLAMA_DEFAULT_MODEL || "deepseek-r1:1.5b",
      temperature: 0.5, // Mais preciso para metadados
    });
  }

  /**
   * Inicializa o curator
   */
  async initialize() {
    console.log("🔧 Inicializando MusicCurator...");

    if (!this.plexToken) {
      console.warn("⚠️  PLEX_TOKEN não configurado. Algumas funcionalidades podem não funcionar.");
    }

    // Verifica conexão com Plex
    await this.checkPlexConnection();

    // Verifica conexão com Ollama (AllFather)
    await this.checkAIConnection();

    console.log("✅ MusicCurator inicializado!");
  }

  /**
   * Verifica conexão com o AllFather/Ollama
   */
  async checkAIConnection() {
    try {
      const isConnected = await this.allfather.checkConnection();

      if (isConnected) {
        console.log("🧠 AllFather conectado! IA disponível.");

        // Verifica se o modelo está disponível
        const hasModel = await this.allfather.hasModel(this.allfather.model);
        if (!hasModel) {
          console.warn(`⚠️  Modelo ${this.allfather.model} não encontrado. Baixe com: ./ollama-setup.sh pull ${this.allfather.model}`);
        }
      } else {
        console.warn("⚠️  AllFather não conectado. Funcionalidades de IA desabilitadas.");
      }

      return isConnected;
    } catch (error) {
      console.warn("⚠️  Erro ao verificar AllFather:", error.message);
      return false;
    }
  }

  /**
   * Verifica conexão com o servidor Plex
   */
  async checkPlexConnection() {
    try {
      const response = await axios.get(`${this.plexUrl}/identity`, {
        headers: {
          "X-Plex-Token": this.plexToken,
          Accept: "application/json",
        },
        timeout: 5000,
      });

      console.log("✅ Conexão com Plex estabelecida:", response.data.MediaContainer?.machineIdentifier);
      return true;
    } catch (error) {
      if (error.code === "ECONNREFUSED") {
        console.warn("⚠️  Não foi possível conectar ao Plex. Certifique-se de que está rodando.");
      } else {
        console.warn("⚠️  Erro ao conectar com Plex:", error.message);
      }
      return false;
    }
  }

  /**
   * Escaneia a biblioteca de música
   */
  async scanLibrary() {
    console.log("📚 Escaneando biblioteca de música...");

    try {
      // Obtém todas as bibliotecas
      const response = await axios.get(`${this.plexUrl}/library/sections`, {
        headers: {
          "X-Plex-Token": this.plexToken,
          Accept: "application/json",
        },
      });

      const sections = response.data.MediaContainer?.Directory || [];
      const musicLibrary = sections.find((s) => s.type === "artist");

      if (musicLibrary) {
        console.log(`🎵 Biblioteca de música encontrada: ${musicLibrary.title}`);
        this.libraryKey = musicLibrary.key;

        // Obtém as faixas
        await this.getTracks();
      } else {
        console.warn("⚠️  Nenhuma biblioteca de música encontrada no Plex");
      }
    } catch (error) {
      console.error("❌ Erro ao escanear biblioteca:", error.message);
    }
  }

  /**
   * Obtém todas as faixas da biblioteca
   */
  async getTracks() {
    try {
      const response = await axios.get(`${this.plexUrl}/library/sections/${this.libraryKey}/all`, {
        headers: {
          "X-Plex-Token": this.plexToken,
          Accept: "application/json",
        },
      });

      this.tracks = response.data.MediaContainer?.Metadata || [];
      console.log(`📊 Total de artistas encontrados: ${this.tracks.length}`);
    } catch (error) {
      console.error("❌ Erro ao obter faixas:", error.message);
    }
  }

  /**
   * Organiza as faixas da biblioteca
   */
  async organizeTracks() {
    console.log("🗂️  Organizando faixas...");

    // Aqui você pode implementar lógica de organização
    // Por exemplo: verificar tags, ordenar por gênero, etc.

    const stats = {
      total: this.tracks.length,
      organized: 0,
    };

    console.log(`📊 Estatísticas: ${stats.total} itens processados`);
    return stats;
  }

  /**
   * Atualiza metadados das faixas
   */
  async updateMetadata() {
    console.log("🏷️  Atualizando metadados...");

    // Aqui você pode implementar lógica para atualizar metadados
    // Por exemplo: buscar informações de APIs externas, corrigir tags, etc.

    console.log("✅ Metadados verificados!");
  }

  /**
   * ==================================================================
   * FUNCIONALIDADES COM IA (AllFather)
   * ==================================================================
   */

  /**
   * Analisa uma faixa e retorna metadados enriquecidos com IA
   */
  async analyzeTrackWithAI(trackInfo) {
    try {
      console.log(`🧠 Analisando "${trackInfo.name}" com IA...`);

      const prompt = this.allfather.createPrompt("music-metadata-analyzer", {
        trackName: trackInfo.name,
        artist: trackInfo.artist,
        year: trackInfo.year,
        album: trackInfo.album,
      });

      const metadata = await this.allfather.askForJSON(prompt);

      console.log(`✅ Análise concluída: ${metadata.genre} - ${metadata.mood}`);
      return metadata;
    } catch (error) {
      console.error("❌ Erro ao analisar faixa:", error.message);
      return null;
    }
  }

  /**
   * Detecta e sugere gênero musical para uma faixa
   */
  async detectGenre(trackInfo) {
    try {
      const prompt = this.allfather.createPrompt("music-genre-detector", {
        trackName: trackInfo.name,
        artist: trackInfo.artist,
      });

      const genre = await this.allfather.askWithPrompt(prompt);
      return genre.trim();
    } catch (error) {
      console.error("❌ Erro ao detectar gênero:", error.message);
      return null;
    }
  }

  /**
   * Corrige nome de artista com possíveis erros
   */
  async correctArtistName(artistName) {
    try {
      const prompt = this.allfather.createPrompt("artist-name-corrector", {
        artistName: artistName,
      });

      const correctedName = await this.allfather.askWithPrompt(prompt);

      if (correctedName !== artistName) {
        console.log(`🔧 Correção sugerida: "${artistName}" → "${correctedName}"`);
      }

      return correctedName.trim();
    } catch (error) {
      console.error("❌ Erro ao corrigir nome:", error.message);
      return artistName;
    }
  }

  /**
   * Detecta músicas duplicadas na biblioteca
   */
  async detectDuplicates(trackList) {
    try {
      console.log("🔍 Detectando duplicatas com IA...");

      const trackNames = trackList.map((t) => `${t.name} - ${t.artist}`);

      const prompt = this.allfather.createPrompt("duplicate-detector", {
        tracks: trackNames,
      });

      const result = await this.allfather.askForJSON(prompt);

      if (result.duplicates && result.duplicates.length > 0) {
        console.log(`⚠️  Encontradas ${result.duplicates.length} possíveis duplicatas`);
      } else {
        console.log("✅ Nenhuma duplicata detectada");
      }

      return result;
    } catch (error) {
      console.error("❌ Erro ao detectar duplicatas:", error.message);
      return { duplicates: [], unique: [] };
    }
  }

  /**
   * Analisa o mood/sentimento de uma faixa
   */
  async analyzeMood(trackInfo) {
    try {
      const prompt = this.allfather.createPrompt("track-mood-analyzer", {
        trackName: trackInfo.name,
        artist: trackInfo.artist,
      });

      const mood = await this.allfather.askWithPrompt(prompt);
      return mood.trim();
    } catch (error) {
      console.error("❌ Erro ao analisar mood:", error.message);
      return null;
    }
  }

  /**
   * Gera descrição para um álbum
   */
  async generateAlbumDescription(albumInfo) {
    try {
      const prompt = this.allfather.createPrompt("album-description-generator", {
        albumName: albumInfo.name,
        artist: albumInfo.artist,
        year: albumInfo.year,
        genre: albumInfo.genre,
      });

      const description = await this.allfather.askWithPrompt(prompt);
      return description.trim();
    } catch (error) {
      console.error("❌ Erro ao gerar descrição:", error.message);
      return null;
    }
  }

  /**
   * Sugere nomes para playlists baseado em características
   */
  async suggestPlaylistName(characteristics) {
    try {
      const prompt = this.allfather.createPrompt("playlist-name-suggester", {
        mood: characteristics.mood,
        genre: characteristics.genre,
        era: characteristics.era,
        description: characteristics.description,
      });

      const suggestions = await this.allfather.askWithPrompt(prompt);
      return suggestions
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s);
    } catch (error) {
      console.error("❌ Erro ao sugerir nomes:", error.message);
      return [];
    }
  }

  /**
   * Processa lote de faixas com análise de IA
   */
  async batchAnalyzeTracks(tracks, maxConcurrent = 5) {
    console.log(`🔄 Processando ${tracks.length} faixas em lote...`);

    const results = [];

    // Processa em lotes para não sobrecarregar
    for (let i = 0; i < tracks.length; i += maxConcurrent) {
      const batch = tracks.slice(i, i + maxConcurrent);

      console.log(`📦 Processando lote ${Math.floor(i / maxConcurrent) + 1}/${Math.ceil(tracks.length / maxConcurrent)}...`);

      const batchPromises = batch.map((track) =>
        this.analyzeTrackWithAI(track).catch((error) => {
          console.error(`Erro ao processar ${track.name}:`, error.message);
          return null;
        }),
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Pequena pausa entre lotes
      if (i + maxConcurrent < tracks.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log(`✅ Processamento em lote concluído: ${results.filter((r) => r !== null).length}/${tracks.length} sucesso`);

    return results;
  }
}
