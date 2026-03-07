import dotenv from "dotenv";
import { AlbumConsolidator } from "../src/album-consolidator.js";

dotenv.config();

/**
 * Script para testar normalização Title Case
 */
async function testNormalization() {
  try {
    console.log("🧪 Teste de Normalização Title Case");
    console.log("=".repeat(80));

    const consolidator = new AlbumConsolidator();

    // Exemplos de nomes para testar normalização
    const testNames = [
      "The Dark Side of the Moon",
      "the dark side of the moon (remastered 2011)",
      "Dark Side Of Moon [MP4] [16B-44100kHz]",
      "Orphans Of The Singe (2022) [MP4] [16B-44100kHz]",
      "The Singularity (2022) [MP4] [16B-44100kHz]",
      "Noche del Chupacabra (remastered 2025) (2011) [MP4] [16B-44100kHz]",
      "Abbey Road - The Beatles",
      "wish you were here",
      "OK Computer",
      "The Wall",
      "Animals (2018 Remix)",
      "Random Access Memories [FLAC 24bit/96kHz]",
      "led zeppelin iv remastered",
      "moving pictures [CD FLAC]",
      "THE WHO SELL OUT [MONO]",
    ];

    console.log("\n📝 Exemplos de normalização Title Case:\n");

    for (const originalName of testNames) {
      const normalized = consolidator.normalizeAlbumName(originalName);
      console.log(`📀 "${originalName}"`);
      console.log(`   → "${normalized}"`);
      console.log();
    }

    console.log("✅ Teste concluído!");
    console.log("\nObserve que:");
    console.log("• Formato Title Case aplicado (primeira letra maiúscula em cada palavra)");
    console.log("• Tags técnicas em [colchetes] são preservadas no final");
    console.log("• Apenas 'remastered' redundante é removido, anos mantidos");
    console.log("• Espaçamento normalizado e consistente");
  } catch (error) {
    console.error("❌ Erro no teste:", error);
  }
}

testNormalization();
