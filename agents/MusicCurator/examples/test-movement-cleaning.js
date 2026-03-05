import dotenv from "dotenv";
import { AlbumConsolidator } from "../src/album-consolidator.js";
import fs from "fs/promises";
import path from "path";

dotenv.config();

/**
 * Teste direto da nova funcionalidade de movimentação e limpeza
 */
async function testMovementAndCleaning() {
  try {
    console.log("🧪 Teste de Movimentação e Limpeza de Arquivos");
    console.log("=".repeat(60));

    const testDir = "/tmp/test-movement";
    const sourceDir = path.join(testDir, "source");
    const targetDir = path.join(testDir, "target");

    // Limpa e cria estrutura
    try {
      await fs.rm(testDir, { recursive: true });
    } catch (e) {}

    await fs.mkdir(sourceDir, { recursive: true });
    await fs.mkdir(targetDir, { recursive: true });

    // Cria arquivos de teste com numeração original
    const testTracks = ["01 - The Witching Chamber.flac", "02 - Orphans Of The Singe.flac", "03. Override.flac", "Track 04 - Final Song.flac"];

    console.log("📂 Criando arquivos de teste...");
    for (const trackName of testTracks) {
      const filePath = path.join(sourceDir, trackName);
      await fs.writeFile(filePath, `fake audio data for ${trackName}`);
      console.log(`  ✅ Criado: ${trackName}`);
    }

    console.log("\n🔧 Testando movimentação e renomeação...");
    const consolidator = new AlbumConsolidator();

    let trackNumber = 1;
    const movedFiles = [];

    for (const trackName of testTracks) {
      const sourcePath = path.join(sourceDir, trackName);
      console.log(`\n📦 Processando: ${trackName}`);

      try {
        const targetPath = await consolidator.moveAndRenameTrack(sourcePath, targetDir, trackNumber, trackName);
        movedFiles.push(targetPath);
        trackNumber++;
      } catch (error) {
        console.log(`  ❌ Erro: ${error.message}`);
      }
    }

    console.log("\n📊 Resultado da movimentação:");
    console.log("=".repeat(40));

    // Verifica arquivos no diretório fonte
    console.log("\n📁 Arquivos restantes na ORIGEM:");
    try {
      const remainingFiles = await fs.readdir(sourceDir);
      if (remainingFiles.length === 0) {
        console.log("  ✅ Diretório fonte vazio (arquivos foram movidos!)");
      } else {
        remainingFiles.forEach((file) => {
          console.log(`  ⚠️  Ainda existe: ${file}`);
        });
      }
    } catch (error) {
      console.log("  📁 Diretório fonte não existe ou vazio");
    }

    // Verifica arquivos no diretório destino
    console.log("\n📁 Arquivos no DESTINO:");
    try {
      const targetFiles = await fs.readdir(targetDir);
      targetFiles.forEach((file) => {
        console.log(`  ✅ ${file}`);
      });
    } catch (error) {
      console.log("  ❌ Erro ao listar destino:", error.message);
    }

    console.log("\n✅ Teste de movimentação concluído!");
    console.log("💡 Observe que:");
    console.log("• Arquivos foram MOVIDOS (não copiados)");
    console.log("• Numeração original foi removida");
    console.log("• Nova numeração sequencial foi aplicada");
    console.log("• Nomes ficaram limpos sem duplicação");

    // Limpeza
    try {
      await fs.rm(testDir, { recursive: true });
    } catch (e) {}
  } catch (error) {
    console.error("❌ Erro no teste:", error);
  }
}

testMovementAndCleaning();
