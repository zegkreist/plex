import dotenv from "dotenv";
import { AllFather } from "@plex-agents/allfather";
import { AlbumConsolidator } from "../src/album-consolidator.js";
import { exec } from "child_process";
import { promisify } from "util";

dotenv.config();

const execAsync = promisify(exec);

/**
 * TESTE ESPECÍFICO para CONSOLIDAÇÃO RATAMAHATTA + ITSARI
 * Remove tags [CURATED] temporariamente para testar se são do mesmo álbum
 */
async function testRatamahattaItsariConsolidation() {
  try {
    const artistPath = "/home/zegkreist/Documents/Pessoal/plex_server/music/Sepultura";

    console.log("🎵 TESTE ESPECÍFICO - RATAMAHATTA + ITSARI");
    console.log("=".repeat(80));
    console.log("🔍 Este script vai:");
    console.log("   - Remover temporariamente tags [CURATED] de Ratamahatta e Sepultura 179");
    console.log("   - Verificar similaridade entre os covers com threshold 50%");
    console.log("   - Usar AllFather para determinar nome correto do álbum");
    console.log("   - Consolidar se forem do mesmo álbum");
    console.log("=".repeat(80));

    // Remove tags [CURATED] temporariamente para permitir reprocessamento
    console.log("\n🔧 Removendo tags [CURATED] temporariamente...");
    try {
      await execAsync(`cd "${artistPath}" && mv "Ratamahatta [CURATED]" "Ratamahatta" 2>/dev/null || true`);
      await execAsync(`cd "${artistPath}" && mv "Sepultura 179 [CURATED]" "Sepultura 179" 2>/dev/null || true`);
      await execAsync(`cd "${artistPath}" && rm -f "Ratamahatta/.curated" "Sepultura 179/.curated" 2>/dev/null || true`);
      console.log("✅ Tags removidas temporariamente");
    } catch (error) {
      console.log("⚠️  Erro removendo tags, tentando continuar...");
    }

    // Inicializa AllFather
    console.log("\n🧠 Inicializando AllFather...");
    const allfather = new AllFather({
      ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
      model: process.env.OLLAMA_DEFAULT_MODEL || "deepseek-r1:7b",
      temperature: 0.1,
    });

    if (!(await allfather.checkConnection())) {
      console.error("❌ Ollama não está conectado");
      process.exit(1);
    }

    console.log("✅ AllFather conectado!");

    const consolidator = new AlbumConsolidator(allfather);

    // Configurações específicas para teste
    const options = {
      dryRun: false, // Consolidação real
      skipCurated: true, // Pula curados (agora sem tags)
      similarityThreshold: 0.5, // 50% para detectar similaridade
      normalizeToTitleCase: true, // Title Case + [CURATED]
      normalizeAllTracks: false, // Foca na consolidação, não normalização geral
    };

    console.log("\n⚙️  Configurações TESTE RATAMAHATTA/ITSARI:");
    console.log(`   - Threshold similaridade: ${options.similarityThreshold * 100}%`);
    console.log(`   - Consolidação: ${!options.dryRun ? "REAL" : "Simulação"}`);

    console.log("\n📂 Estado atual (após remoção de tags):");
    const { stdout } = await execAsync(`ls -la "${artistPath}"`);
    console.log(stdout);

    console.log("\n❓ Proceder com teste de consolidação?");
    console.log("💡 Aguardando 3 segundos...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log("\n🚀 INICIANDO TESTE...\n");

    // Executa consolidação específica
    const result = await consolidator.consolidateArtistAlbums(artistPath, "Sepultura", options);

    console.log("\n" + "=".repeat(80));
    console.log("📊 RESULTADO DO TESTE RATAMAHATTA/ITSARI");
    console.log("=".repeat(80));

    if (result.consolidationResults && result.consolidationResults.length > 0) {
      console.log("✅ CONSOLIDAÇÃO DETECTADA!");
      result.consolidationResults.forEach((cr) => {
        console.log(`🎯 Álbum consolidado: "${cr.correctName}"`);
        console.log(`📦 Faixas: ${cr.result.movedTracks?.length || 0}`);
      });
    } else if (result.normalizationResults) {
      console.log("⚠️  Normalizações executadas, mas sem consolidação");
      result.normalizationResults.forEach((nr) => {
        console.log(`📝 Normalizado: "${nr.correctAlbumName}"`);
      });
    } else {
      console.log("ℹ️  Nenhuma consolidação necessária");
      console.log("💭 Ratamahatta e Itsari podem ser álbuns diferentes");
    }

    console.log("\n🎸 Teste concluído!");
    console.log("=".repeat(80));
  } catch (error) {
    console.error("\n❌ ERRO no teste:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testRatamahattaItsariConsolidation();
