import { AlbumConsolidator } from "../src/album-consolidator.js";
import fs from "fs/promises";
import path from "path";

/**
 * Teste da nova funcionalidade de remoção automática de pastas originais
 */
async function testOriginalFolderRemoval() {
  try {
    console.log("🧪 Teste de Remoção Automática de Pastas Originais");
    console.log("=".repeat(60));

    const testDir = "/tmp/test-folder-removal";

    // Limpa e cria estrutura
    try {
      await fs.rm(testDir, { recursive: true });
    } catch (e) {}

    await fs.mkdir(testDir, { recursive: true });

    // Cenário 1: Pasta com apenas cover (deve ser removida)
    const folder1 = path.join(testDir, "Album com Cover");
    await fs.mkdir(folder1);
    await fs.writeFile(path.join(folder1, "cover.jpg"), "fake image");
    await fs.writeFile(path.join(folder1, "album.nfo"), "metadata");

    console.log("📁 Cenário 1: Pasta só com cover/metadata");
    console.log(`   Criada: ${folder1}`);
    console.log("   Conteúdo: cover.jpg, album.nfo");

    // Cenário 2: Pasta com música (NÃO deve ser removida)
    const folder2 = path.join(testDir, "Album com Musica");
    await fs.mkdir(folder2);
    await fs.writeFile(path.join(folder2, "01 - Song.flac"), "fake audio");
    await fs.writeFile(path.join(folder2, "cover.jpg"), "fake image");

    console.log("\n📁 Cenário 2: Pasta com música");
    console.log(`   Criada: ${folder2}`);
    console.log("   Conteúdo: 01 - Song.flac, cover.jpg");

    // Cenário 3: Pasta completamente vazia (deve ser removida)
    const folder3 = path.join(testDir, "Album Vazio");
    await fs.mkdir(folder3);

    console.log("\n📁 Cenário 3: Pasta completamente vazia");
    console.log(`   Criada: ${folder3}`);
    console.log("   Conteúdo: (vazio)");

    // Testa a remoção
    console.log("\n🧹 Testando remoção automática...");
    const consolidator = new AlbumConsolidator();

    console.log("\n--- Testando Cenário 1 ---");
    await consolidator.removeOriginalAlbumFolder(folder1);

    console.log("\n--- Testando Cenário 2 ---");
    await consolidator.removeOriginalAlbumFolder(folder2);

    console.log("\n--- Testando Cenário 3 ---");
    await consolidator.removeOriginalAlbumFolder(folder3);

    // Verifica resultado
    console.log("\n📊 Resultado do teste:");
    console.log("=".repeat(40));

    try {
      const remainingFolders = await fs.readdir(testDir);
      console.log(`\n📁 Pastas que restaram:`);

      if (remainingFolders.length === 0) {
        console.log("   ✅ Todas as pastas foram removidas apropriadamente");
      } else {
        for (const folder of remainingFolders) {
          const folderPath = path.join(testDir, folder);
          const files = await fs.readdir(folderPath);
          console.log(`   📂 ${folder}: ${files.length} arquivos`);
          files.forEach((file) => {
            console.log(`      - ${file}`);
          });
        }
      }
    } catch (error) {
      console.log("   ✅ Diretório de teste vazio");
    }

    console.log("\n💡 Resultado esperado:");
    console.log("   ❌ Album com Cover: REMOVIDO (só tinha cover/metadata)");
    console.log("   ✅ Album com Musica: MANTIDO (tem arquivo de música)");
    console.log("   ❌ Album Vazio: REMOVIDO (completamente vazio)");

    // Limpeza
    try {
      await fs.rm(testDir, { recursive: true });
    } catch (e) {}

    console.log("\n✅ Teste concluído!");
  } catch (error) {
    console.error("❌ Erro no teste:", error);
  }
}

testOriginalFolderRemoval();
