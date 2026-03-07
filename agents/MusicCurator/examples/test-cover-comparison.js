import dotenv from "dotenv";
import { AllFather } from "@plex-agents/allfather";

dotenv.config();

/**
 * Script para testar a comparação de covers por conteúdo usando LLM
 *
 * USO:
 * node examples/test-cover-comparison.js [caminho_cover1] [caminho_cover2]
 */
async function main() {
  try {
    const cover1 = process.argv[2];
    const cover2 = process.argv[3];

    if (!cover1 || !cover2) {
      console.error("❌ Uso: node examples/test-cover-comparison.js [caminho_cover1] [caminho_cover2]");
      console.error("\nExemplo:");
      console.error("  node examples/test-cover-comparison.js /music/Pink\\ Floyd/The\\ Dark\\ Side/cover.jpg /music/Pink\\ Floyd/Dark\\ Side/cover.jpg");
      process.exit(1);
    }

    console.log("🎨 Teste de Comparação de Covers por Conteúdo (LLM)");
    console.log("=".repeat(80));

    // Inicializa AllFather
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

    // Verifica modelo de visão
    const hasVisionModel = await allfather.hasModel("llama3.2-vision");
    if (!hasVisionModel) {
      console.error("❌ Modelo de visão não encontrado. Instale com:");
      console.error("    ollama pull llama3.2-vision");
      process.exit(1);
    }

    console.log("✅ Tudo pronto!");

    // Compara covers
    console.log("\n🔍 Comparando covers...");
    console.log(`   Cover 1: ${cover1}`);
    console.log(`   Cover 2: ${cover2}`);

    const similarity = await allfather.compareImagesByContent(cover1, cover2);

    console.log("\n" + "=".repeat(80));
    console.log("📊 RESULTADO");
    console.log("=".repeat(80));

    if (similarity !== null) {
      const percentage = (similarity * 100).toFixed(1);
      console.log(`\n🎯 Similaridade: ${percentage}%`);

      if (similarity >= 0.9) {
        console.log("✅ Alto grau de similaridade - provavelmente o mesmo álbum");
      } else if (similarity >= 0.7) {
        console.log("⚠️  Similaridade moderada - pode ser o mesmo álbum");
      } else {
        console.log("❌ Baixa similaridade - provavelmente álbuns diferentes");
      }
    } else {
      console.log("❌ Não foi possível comparar as imagens");
    }

    console.log("\n✅ Teste concluído!");
  } catch (error) {
    console.error("\n❌ Erro:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
