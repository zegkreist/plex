import dotenv from "dotenv";
import { AlbumConsolidator } from "../src/album-consolidator.js";

dotenv.config();

/**
 * Script para testar se a tag [CURATED] está sendo adicionada corretamente
 */
async function testCuratedTag() {
  try {
    console.log("🧪 Teste da Tag [CURATED]");
    console.log("=".repeat(50));

    const consolidator = new AlbumConsolidator();

    // Simula um grupo de álbuns
    const mockGroup = [
      {
        name: "The Singularity (2022) [MP4] [16B-44100kHz]",
        path: "/fake/path/1",
        artist: "Wo Fat",
        trackCount: 7,
        tracks: [{ name: "Track 1" }],
      },
    ];

    console.log("\n📝 Teste 1: Com normalização ativada");
    const result1 = await consolidator.determineCorrectAlbumName(mockGroup, {
      normalizeToTitleCase: true,
    });
    console.log(`   Nome original: "${mockGroup[0].name}"`);
    console.log(`   Nome determinado: "${result1.correctName}"`);
    console.log(`   ✅ Tag [CURATED] presente: ${result1.correctName.includes("[CURATED]") ? "SIM" : "NÃO"}`);

    console.log("\n📝 Teste 2: Com normalização desativada");
    const result2 = await consolidator.determineCorrectAlbumName(mockGroup, {
      normalizeToTitleCase: false,
    });
    console.log(`   Nome original: "${mockGroup[0].name}"`);
    console.log(`   Nome determinado: "${result2.correctName}"`);
    console.log(`   ✅ Tag [CURATED] presente: ${result2.correctName.includes("[CURATED]") ? "SIM" : "NÃO"}`);

    console.log("\n✅ Teste concluído!");
  } catch (error) {
    console.error("❌ Erro no teste:", error);
  }
}

testCuratedTag();
