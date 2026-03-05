import dotenv from "dotenv";
import { AllFather } from "@plex-agents/allfather";
import { AlbumConsolidator } from "../src/album-consolidator.js";

// Carrega variáveis de ambiente
dotenv.config();

/**
 * TESTE REAL de consolidação física no Wo Fat
 * ⚠️  ATENÇÃO: Este script vai MOVER ARQUIVOS DE VERDADE!
 * Certifique-se de ter BACKUP antes de executar!
 */
async function testRealWoFat() {
  try {
    const artistPath = "/home/zegkreist/Documents/Pessoal/plex_server/music/Wo Fat";

    console.log("🎵 MusicCurator - TESTE REAL WO FAT");
    console.log("=".repeat(80));
    console.log("⚠️  ATENÇÃO: CONSOLIDAÇÃO FÍSICA ATIVADA!");
    console.log("⚠️  ARQUIVOS SERÃO MOVIDOS E RENOMEADOS!");
    console.log("⚠️  CERTIFIQUE-SE DE TER BACKUP!");
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
      console.warn("⚠️  Modelo de visão não encontrado. Usando apenas hashing perceptual.");
    } else {
      console.log("✅ Modelo de visão disponível: llama3.2-vision");
    }

    // Inicializa o consolidador
    console.log("\n🔧 Inicializando consolidador...");
    const consolidator = new AlbumConsolidator(allfather);

    console.log(`\n📂 Processando TESTE REAL: Wo Fat`);
    console.log(`📍 Caminho: ${artistPath}`);

    // Opções para CONSOLIDAÇÃO REAL
    const options = {
      dryRun: false, // ← CONSOLIDAÇÃO FÍSICA REAL!
      skipCurated: true, // Pula álbuns já curados
      similarityThreshold: 0.95, // Alto para garantir que só consolide álbuns realmente similares
      normalizeToTitleCase: true, // Aplica Title Case + tag [CURATED]
    };

    console.log("\n⚙️  Opções de CONSOLIDAÇÃO REAL:");
    console.log(`   - Modo Dry-Run: ${options.dryRun ? "SIM (simulação)" : "NÃO (CONSOLIDAÇÃO FÍSICA REAL!)"}`);
    console.log(`   - Pular álbuns curados: ${options.skipCurated ? "SIM" : "NÃO"}`);
    console.log(`   - Threshold de similaridade: ${(options.similarityThreshold * 100).toFixed(0)}% (alto para segurança)`);
    console.log(`   - Normalização Title Case: ${options.normalizeToTitleCase ? "SIM" : "NÃO"}`);

    console.log("\n🔥 CONSOLIDAÇÃO FÍSICA - ARQUIVOS SERÃO MOVIDOS!");
    console.log("   - Faixas serão renumeradas sequencialmente");
    console.log("   - Pastas de álbuns serão reorganizadas");
    console.log("   - Cover será copiado para álbum consolidado");
    console.log("   - Pastas vazias serão removidas");
    console.log("   - Tag [CURATED] será aplicada aos nomes");

    // Pergunta confirmação
    console.log("\n❓ Tem certeza que deseja continuar? (Este teste é irreversível!)");
    console.log("💡 Pressione Ctrl+C para cancelar ou aguarde 5 segundos...");

    // Aguarda 5 segundos para dar chance de cancelar
    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log("\n🚀 INICIANDO CONSOLIDAÇÃO FÍSICA REAL...\n");

    // Executa a consolidação REAL
    const result = await consolidator.consolidateArtistAlbums(artistPath, "Wo Fat", options);

    // Relatório final
    console.log("\n" + "=".repeat(80));
    console.log("📊 RELATÓRIO FINAL DO TESTE REAL");
    console.log("=".repeat(80));

    if (result.consolidationResults) {
      const successful = result.consolidationResults.filter((cr) => cr.result.success).length;
      const failed = result.consolidationResults.filter((cr) => !cr.result.success).length;
      const totalTracks = result.consolidationResults.reduce((sum, cr) => sum + (cr.result.movedTracks?.length || 0), 0);

      console.log(`✅ Consolidações bem-sucedidas: ${successful}`);
      console.log(`❌ Consolidações com erro: ${failed}`);
      console.log(`🎵 Total de faixas reorganizadas: ${totalTracks}`);

      if (successful > 0) {
        console.log("\n🎯 Álbuns consolidados fisicamente:");
        for (const cr of result.consolidationResults.filter((cr) => cr.result.success)) {
          console.log(`   ✅ "${cr.correctName}" - ${cr.result.movedTracks?.length || 0} faixas`);
        }
      }
    } else {
      console.log("📀 Nenhum grupo de álbuns similares encontrado para consolidar");
    }

    console.log("\n✅ TESTE REAL CONCLUÍDO!");
    console.log("💡 Verifique o diretório Wo Fat para confirmar o resultado");
  } catch (error) {
    console.error("\n❌ Erro no teste real:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testRealWoFat();
