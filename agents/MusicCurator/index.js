import dotenv from "dotenv";
import { MusicCurator } from "./src/curator.js";

// Carrega variáveis de ambiente
dotenv.config();

/**
 * MusicCurator Agent
 * Responsável por organizar e curar a biblioteca de música do Plex
 */
class MusicCuratorAgent {
  constructor() {
    this.curator = new MusicCurator();
    this.isRunning = false;
  }

  /**
   * Inicia o agent
   */
  async start() {
    console.log("🎵 MusicCurator Agent iniciando...");
    this.isRunning = true;

    try {
      await this.curator.initialize();
      console.log("✅ MusicCurator Agent iniciado com sucesso!");

      // Loop principal do agent
      await this.run();
    } catch (error) {
      console.error("❌ Erro ao iniciar MusicCurator:", error.message);
      process.exit(1);
    }
  }

  /**
   * Loop principal do agent
   */
  async run() {
    while (this.isRunning) {
      try {
        console.log("\n🔍 Verificando biblioteca de música...");

        await this.curator.scanLibrary();
        await this.curator.organizeTracks();
        await this.curator.updateMetadata();

        console.log("✅ Curadoria concluída!");

        // Aguarda intervalo antes da próxima execução
        const interval = process.env.CURATOR_INTERVAL || 3600000; // 1 hora por padrão
        console.log(`⏰ Próxima execução em ${interval / 60000} minutos`);
        await this.sleep(interval);
      } catch (error) {
        console.error("❌ Erro durante curadoria:", error.message);
        await this.sleep(60000); // Aguarda 1 minuto antes de tentar novamente
      }
    }
  }

  /**
   * Para o agent
   */
  stop() {
    console.log("🛑 Parando MusicCurator Agent...");
    this.isRunning = false;
  }

  /**
   * Função auxiliar para aguardar
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Inicializa o agent
const agent = new MusicCuratorAgent();

// Handlers para encerramento gracioso
process.on("SIGINT", () => {
  agent.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  agent.stop();
  process.exit(0);
});

// Inicia o agent
agent.start();
