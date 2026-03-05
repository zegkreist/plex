import dotenv from "dotenv";
import { AllFather } from "@plex-agents/allfather";
import { AlbumConsolidator } from "../src/album-consolidator.js";

// Carrega variáveis de ambiente
dotenv.config();

/**
 * Script para consolidar álbuns duplicados/separados
 *
 * USO:
 * node examples/consolidate-albums.js [caminho_para_pasta_artista]
 *
 * EXEMPLO:
 * node examples/consolidate-albums.js /music/Pink\ Floyd
 */
async function main() {
  try {
    // Obtém o caminho do artista dos argumentos ou usa exemplo
    const artistPath = process.argv[2];

    if (!artistPath) {
      console.error("❌ Uso: node examples/consolidate-albums.js [caminho_para_pasta_artista]");
      console.error("\nExemplo: node examples/consolidate-albums.js /music/Pink\\ Floyd");
      process.exit(1);
    }

    console.log("🎵 MusicCurator - Consolidador de Álbuns");
    console.log("=".repeat(80));

    // Inicializa o AllFather
    console.log("\n🧠 Inicializando AllFather...");
    const allfather = new AllFather({
      ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
      model: process.env.OLLAMA_DEFAULT_MODEL || "deepseek-r1:7b",
      temperature: 0.1,
    });

    // Verifica conexão
    const isConnected = await allfather.checkConnection();
    if (!isConnected) {
      console.error("❌ Ollama não está rodando. Inicie com: ollama serve");
      process.exit(1);
    }

    console.log("✅ AllFather conectado!");

    // Verifica se tem modelo de visão
    console.log("\n🔍 Verificando modelo de visão...");
    const hasVisionModel = await allfather.hasModel("llama3.2-vision");
    if (!hasVisionModel) {
      console.warn("⚠️  Modelo de visão não encontrado. Baixe com:");
      console.warn("    ollama pull llama3.2-vision");
      console.warn("\n⚠️  O consolidador precisa do modelo de visão para comparar covers.");

      // Pergunta se quer continuar mesmo assim
      console.log("\n❓ Deseja continuar mesmo sem o modelo de visão? (não recomendado)");
      process.exit(1);
    }

    console.log("✅ Modelo de visão disponível: llama3.2-vision");

    // Inicializa o consolidador
    console.log("\n🔧 Inicializando consolidador...");
    const consolidator = new AlbumConsolidator(allfather);

    // Extrai o nome do artista do caminho
    const artistName = artistPath.split("/").pop();

    console.log(`\n📂 Processando artista: ${artistName}`);
    console.log(`📍 Caminho: ${artistPath}`);

    // Opções de consolidação
    const options = {
      dryRun: true, // Modo dry-run: não faz alterações, apenas analisa
      skipCurated: true, // Pula álbuns já curados
      similarityThreshold: 0.85, // Threshold de similaridade (0-1)
    };

    console.log("\n⚙️  Opções:");
    console.log(`   - Modo Dry-Run: ${options.dryRun ? "SIM (não faz alterações)" : "NÃO (faz alterações)"}`);
    console.log(`   - Pular álbuns curados: ${options.skipCurated ? "SIM" : "NÃO"}`);
    console.log(`   - Threshold de similaridade: ${(options.similarityThreshold * 100).toFixed(0)}%`);

    // Processa o artista
    console.log("\n🚀 Iniciando processamento...\n");
    const { groups, results } = await consolidator.consolidateArtistAlbums(artistPath, artistName, options);

    // Resumo final
    console.log("\n" + "=".repeat(80));
    console.log("📊 RESUMO FINAL");
    console.log("=".repeat(80));
    console.log(`✅ Processamento concluído!`);
    console.log(`📀 Grupos de álbuns similares encontrados: ${groups.length}`);
    console.log(`🎯 Resoluções determinadas: ${results.length}`);

    if (options.dryRun && groups.length > 0) {
      console.log("\n💡 PRÓXIMOS PASSOS:");
      console.log("   1. Revise o relatório acima");
      console.log("   2. Execute novamente com dryRun: false para aplicar as correções");
      console.log("   3. Os álbuns serão marcados como curados após o processamento");
    }

    console.log("\n✅ Script finalizado!");
  } catch (error) {
    console.error("\n❌ Erro:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Executa o script
main();
