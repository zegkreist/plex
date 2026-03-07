import dotenv from "dotenv";
import { AlbumConsolidator } from "../src/album-consolidator.js";
import fs from "fs/promises";
import path from "path";

dotenv.config();

/**
 * Script para testar a consolidação física de álbuns
 * CRIE BACKUPS ANTES DE EXECUTAR EM DADOS REAIS!
 */
async function testPhysicalConsolidation() {
  try {
    console.log("🧪 Teste de Consolidação Física");
    console.log("=".repeat(60));

    const consolidator = new AlbumConsolidator();

    // Cria estrutura de teste
    const testDir = "/tmp/test-consolidation";
    const artistDir = path.join(testDir, "Wo Fat");

    console.log("📂 Criando estrutura de teste...");

    // Limpa diretório se existir
    try {
      await fs.rm(testDir, { recursive: true });
    } catch (e) {
      // Ignora se não existir
    }

    // Cria estrutura
    await fs.mkdir(artistDir, { recursive: true });

    // Álbum 1: "The Singularity"
    const album1 = path.join(artistDir, "The Singularity (2022)");
    await fs.mkdir(album1);
    await fs.writeFile(path.join(album1, "01 - Track One.flac"), "fake audio data");
    await fs.writeFile(path.join(album1, "02 - Track Two.flac"), "fake audio data");
    await fs.writeFile(path.join(album1, "cover.jpg"), "fake image data");

    // Álbum 2: "Orphans Of The Singe" (mesmo cover/álbum)
    const album2 = path.join(artistDir, "Orphans Of The Singe (2022)");
    await fs.mkdir(album2);
    await fs.writeFile(path.join(album2, "Track Three.flac"), "fake audio data");
    await fs.writeFile(path.join(album2, "Track Four.flac"), "fake audio data");
    await fs.copyFile(path.join(album1, "cover.jpg"), path.join(album2, "cover.jpg")); // Mesmo cover

    console.log("✅ Estrutura de teste criada:");
    console.log(`   - ${album1} (2 faixas)`);
    console.log(`   - ${album2} (2 faixas)`);

    console.log("\n🔍 Fazendo consolidação em DRY-RUN...");

    // Primeiro, testa em dry-run
    const dryRunResult = await consolidator.consolidateArtistAlbums(artistDir, "Wo Fat", {
      dryRun: true,
      skipCurated: false,
      similarityThreshold: 0.5, // Baixo para garantir que funcione com dados fake
      normalizeToTitleCase: true,
    });

    if (dryRunResult.groups?.length > 0) {
      console.log("\n🔧 Agora fazendo consolidação FÍSICA (REAL)...");
      console.log("⚠️  ATENÇÃO: Arquivos serão movidos de verdade!");

      // Agora faz consolidação real
      const realResult = await consolidator.consolidateArtistAlbums(artistDir, "Wo Fat", {
        dryRun: false,
        skipCurated: false,
        similarityThreshold: 0.5,
        normalizeToTitleCase: true,
      });

      console.log("\n📁 Verificando resultado...");

      // Lista arquivos após consolidação
      const finalEntries = await fs.readdir(artistDir, { withFileTypes: true });

      console.log("\n📊 Estado final:");
      for (const entry of finalEntries) {
        if (entry.isDirectory()) {
          const albumPath = path.join(artistDir, entry.name);
          const files = await fs.readdir(albumPath);
          console.log(`   📁 ${entry.name}:`);
          for (const file of files) {
            console.log(`      - ${file}`);
          }
        }
      }

      console.log("\n✅ Teste de consolidação física concluído!");

      if (realResult.consolidationResults) {
        const successful = realResult.consolidationResults.filter((cr) => cr.result.success).length;
        const total = realResult.consolidationResults.length;
        console.log(`📈 Resultado: ${successful}/${total} consolidações bem-sucedidas`);
      }
    } else {
      console.log("⚠️  Nenhum grupo de álbuns similares encontrado para testar consolidação");
    }

    // Limpeza
    console.log("\n🧹 Limpando arquivos de teste...");
    try {
      await fs.rm(testDir, { recursive: true });
      console.log("✅ Limpeza concluída");
    } catch (e) {
      console.warn("⚠️  Erro na limpeza:", e.message);
    }
  } catch (error) {
    console.error("❌ Erro no teste:", error);
  }
}

testPhysicalConsolidation();
