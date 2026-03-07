import { AlbumConsolidator } from "../src/album-consolidator.js";
import fs from "fs/promises";
import path from "path";

/**
 * Script para limpar pastas órfãs no Wo Fat
 * Remove pastas que só contêm covers/metadados após consolidação
 */
async function cleanupOrphanFolders() {
  try {
    const woFatPath = "/home/zegkreist/Documents/Pessoal/plex_server/music/Wo Fat";

    console.log("🧹 Limpeza de Pastas Órfãs - Wo Fat");
    console.log("=".repeat(50));
    console.log("💡 Este script remove pastas que ficaram só com covers/metadados");
    console.log("💡 após a consolidação de álbuns");
    console.log("=".repeat(50));

    // Lista todos os diretórios
    console.log("\n📁 Analisando diretórios...");
    const entries = await fs.readdir(woFatPath, { withFileTypes: true });
    const directories = entries.filter((entry) => entry.isDirectory());

    console.log(`\n📊 Encontrados ${directories.length} diretórios:`);

    const consolidator = new AlbumConsolidator();
    let removedCount = 0;
    let keptCount = 0;

    for (const dir of directories) {
      const dirPath = path.join(woFatPath, dir.name);

      console.log(`\n📂 Analisando: ${dir.name}`);

      try {
        const files = await fs.readdir(dirPath);
        const nonHiddenFiles = files.filter((file) => !file.startsWith("."));

        if (nonHiddenFiles.length === 0) {
          console.log("   ✅ Pasta vazia - será removida");
          removedCount++;
        } else {
          // Verifica tipos de arquivo
          const musicExtensions = [".flac", ".mp3", ".m4a", ".wav", ".ogg", ".opus"];
          const hasMusicFiles = nonHiddenFiles.some((file) => {
            const ext = path.extname(file).toLowerCase();
            return musicExtensions.includes(ext);
          });

          if (hasMusicFiles) {
            console.log(`   🎵 Contém ${nonHiddenFiles.length} arquivos incluindo música - será mantida`);
            keptCount++;
          } else {
            console.log(`   🧹 Só contém covers/metadados (${nonHiddenFiles.join(", ")}) - será removida`);
            removedCount++;
          }
        }
      } catch (error) {
        console.log(`   ❌ Erro ao analisar: ${error.message}`);
        keptCount++;
      }
    }

    // Confirmação
    console.log("\n" + "=".repeat(50));
    console.log("📊 RESUMO DA LIMPEZA:");
    console.log(`   🗑️  Pastas a remover: ${removedCount}`);
    console.log(`   🎵 Pastas a manter: ${keptCount}`);
    console.log("=".repeat(50));

    if (removedCount === 0) {
      console.log("✅ Nenhuma pasta órfã encontrada! Diretório já está limpo.");
      return;
    }

    console.log(`\n❓ Confirma a remoção de ${removedCount} pastas órfãs?`);
    console.log("💡 Aguardando 5 segundos... (Ctrl+C para cancelar)");

    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log("\n🚀 Iniciando limpeza...\n");

    // Executa a limpeza
    let actuallyRemoved = 0;
    let errors = 0;

    for (const dir of directories) {
      const dirPath = path.join(woFatPath, dir.name);

      try {
        const files = await fs.readdir(dirPath);
        const nonHiddenFiles = files.filter((file) => !file.startsWith("."));

        const musicExtensions = [".flac", ".mp3", ".m4a", ".wav", ".ogg", ".opus"];
        const hasMusicFiles = nonHiddenFiles.some((file) => {
          const ext = path.extname(file).toLowerCase();
          return musicExtensions.includes(ext);
        });

        if (nonHiddenFiles.length === 0 || !hasMusicFiles) {
          console.log(`🗑️  Removendo: ${dir.name}`);
          await consolidator.removeOriginalAlbumFolder(dirPath);
          actuallyRemoved++;
        }
      } catch (error) {
        console.log(`❌ Erro ao remover ${dir.name}: ${error.message}`);
        errors++;
      }
    }

    // Relatório final
    console.log("\n" + "=".repeat(50));
    console.log("✅ LIMPEZA CONCLUÍDA!");
    console.log(`   🗑️  Pastas removidas: ${actuallyRemoved}`);
    console.log(`   ❌ Erros: ${errors}`);
    console.log("=".repeat(50));

    // Lista estado final
    console.log("\n📁 Estado final do diretório:");
    const finalEntries = await fs.readdir(woFatPath, { withFileTypes: true });
    const finalDirs = finalEntries.filter((entry) => entry.isDirectory());

    finalDirs.forEach((dir) => {
      const isCurated = dir.name.includes("[CURATED]");
      const marker = isCurated ? "✅" : "📂";
      console.log(`   ${marker} ${dir.name}`);
    });

    console.log(`\n💡 Total final: ${finalDirs.length} diretórios`);
    const curatedCount = finalDirs.filter((dir) => dir.name.includes("[CURATED]")).length;
    console.log(`   ✅ Curados: ${curatedCount}`);
    console.log(`   📂 Outros: ${finalDirs.length - curatedCount}`);
  } catch (error) {
    console.error("❌ Erro na limpeza:", error);
  }
}

cleanupOrphanFolders();
