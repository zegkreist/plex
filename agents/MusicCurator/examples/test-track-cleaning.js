import { AlbumConsolidator } from "../src/album-consolidator.js";

/**
 * Script para testar a limpeza de nomes de faixas
 */
async function testTrackNameCleaning() {
  try {
    console.log("🧪 Teste de Limpeza de Nomes de Faixas");
    console.log("=".repeat(60));

    const consolidator = new AlbumConsolidator();

    // Exemplos de nomes de arquivos para testar limpeza
    const testTrackNames = [
      "01 - The Witching Chamber.flac",
      "02 - Orphans Of The Singe.flac",
      "1. Into The Deep.flac",
      "03. Heavy Vibe.flac",
      "Track 04 - Mountain Crusher.flac",
      "05 The Unraveling.flac",
      "6 - Solar Winds.flac",
      "007 - Secret Track.flac",
      "10. Final Song.flac",
      "Track01-QuickStart.flac",
      "99 Heavy Metal Song.flac",
    ];

    console.log("\n📝 Testando limpeza de numeração:\n");

    testTrackNames.forEach((trackName, index) => {
      const cleanName = consolidator.extractCleanTrackName(trackName);
      const paddedNumber = (index + 1).toString().padStart(2, "0");
      const newFileName = `${paddedNumber} - ${cleanName}.flac`;

      console.log(`📀 "${trackName}"`);
      console.log(`   → Nome limpo: "${cleanName}"`);
      console.log(`   → Arquivo final: "${newFileName}"`);
      console.log();
    });

    console.log("✅ Teste de limpeza concluído!");
    console.log("\n💡 Observe que:");
    console.log("• Numeração original é removida");
    console.log("• Nova numeração sequencial é aplicada");
    console.log("• Nomes ficam sem duplicação");
  } catch (error) {
    console.error("❌ Erro no teste:", error);
  }
}

testTrackNameCleaning();
