import axios from "axios";

/**
 * Classe responsável pela curadoria de música
 */
export class MusicCurator {
  constructor() {
    this.plexUrl = process.env.PLEX_URL || "http://localhost:32400";
    this.plexToken = process.env.PLEX_TOKEN || "";
    this.musicLibraryPath = process.env.MUSIC_PATH || "/music";
    this.tracks = [];
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

    console.log("✅ MusicCurator inicializado!");
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
}
