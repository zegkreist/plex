import dotenv from "dotenv";
import { AllFather } from "@plex-agents/allfather";
import { AlbumConsolidator } from "../src/album-consolidator.js";
import fs from "fs/promises";
import path from "path";

dotenv.config();

/**
 * TESTE REAL com cópia dos dados do Wo Fat
 * Copia os dados para um diretório temporário onde temos permissões completas
 */
async function testRealWoFatSafe() {
  try {
    const originalPath = "/home/zegkreist/Documents/Pessoal/plex_server/music/Wo Fat";
    const testPath = "/tmp/wo-fat-test";
    const testArtistPath = path.join(testPath, "Wo Fat");

    console.log("🎵 MusicCurator - TESTE REAL WO FAT (Seguro)");
    console.log("=".repeat(80));
    console.log("💡 Copiando dados para diretório temporário para teste seguro");
    console.log("=".repeat(80));

    // Limpa diretório de teste se existir
    try {
      await fs.rm(testPath, { recursive: true });
    } catch (e) {
      // Ignora se não existir
    }

    // Cria diretório de teste
    await fs.mkdir(testArtistPath, { recursive: true });

    console.log("📂 Copiando álbuns do Wo Fat...");

    // Copia apenas os álbuns similares para o teste
    const albumsToCopy = ["Orphans Of The Singe (2022) [MP4] [16B-44100kHz]", "The Singularity (2022) [MP4] [16B-44100kHz]"];

    for (const albumName of albumsToCopy) {
      const sourcePath = path.join(originalPath, albumName);
      const targetPath = path.join(testArtistPath, albumName);

      try {
        // Copia diretório por inteiro usando o comando cp
        await fs.mkdir(targetPath, { recursive: true });

        // Lista arquivos do álbum original
        const files = await fs.readdir(sourcePath);

        for (const file of files) {
          const sourceFilePath = path.join(sourcePath, file);
          const targetFilePath = path.join(targetPath, file);

          try {
            await fs.copyFile(sourceFilePath, targetFilePath);
            console.log(`  ✅ Copiado: ${albumName}/${file}`);
          } catch (copyError) {
            console.log(`  ⚠️  Erro copiando ${file}: ${copyError.message}`);
          }
        }
      } catch (error) {
        console.log(`  ❌ Erro ao copiar álbum ${albumName}: ${error.message}`);
      }
    }

    // Inicializa o AllFather
    console.log("\n🧠 Inicializando AllFather...");
    const allfather = new AllFather({
      ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
      model: process.env.OLLAMA_DEFAULT_MODEL || "deepseek-r1:7b",
      temperature: 0.1,
    });

    if (!(await allfather.checkConnection())) {
      console.error("❌ Ollama não está rodando. Inicie com: ollama serve");
      process.exit(1);
    }

    console.log("✅ AllFather conectado!");

    const consolidator = new AlbumConsolidator(allfather);

    console.log(`\n📂 Testando consolidação física: Wo Fat (Temporário)`);
    console.log(`📍 Caminho: ${testArtistPath}`);

    // Opções para CONSOLIDAÇÃO REAL
    const options = {
      dryRun: false, // ← CONSOLIDAÇÃO FÍSICA REAL!
      skipCurated: false, // Processa todos os álbuns
      similarityThreshold: 0.95, // Alto para garantir
      normalizeToTitleCase: true, // Aplica Title Case + tag [CURATED]
    };

    console.log("\n🚀 INICIANDO CONSOLIDAÇÃO FÍSICA REAL (em diretório temporário)...\n");

    // Executa a consolidação REAL
    const result = await consolidator.consolidateArtistAlbums(testArtistPath, "Wo Fat", options);

    // Lista resultado
    console.log("\n📁 Verificando resultado da consolidação...");
    try {
      const finalEntries = await fs.readdir(testArtistPath, { withFileTypes: true });

      console.log("\n📊 Estado final:");
      for (const entry of finalEntries) {
        if (entry.isDirectory()) {
          const albumPath = path.join(testArtistPath, entry.name);
          const files = await fs.readdir(albumPath);
          console.log(`   📁 ${entry.name}:`);
          for (const file of files.slice(0, 10)) {
            // Limita a 10 arquivos para não poluir
            console.log(`      - ${file}`);
          }
          if (files.length > 10) {
            console.log(`      ... e mais ${files.length - 10} arquivos`);
          }
        }
      }
    } catch (error) {
      console.log("❌ Erro ao listar resultado:", error.message);
    }

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

      if (failed > 0) {
        console.log("\n💥 Falhas:");
        for (const cr of result.consolidationResults.filter((cr) => !cr.result.success)) {
          console.log(`   ❌ "${cr.correctName}" - ${cr.result.error}`);
        }
      }
    } else {
      console.log("📀 Nenhum grupo de álbuns similares encontrado para consolidar");
    }

    console.log("\n✅ TESTE REAL CONCLUÍDO!");
    console.log(`💡 Dados de teste em: ${testArtistPath}`);
    console.log("💡 Para aplicar ao Wo Fat real, corrija as permissões primeiro com:");
    console.log("   sudo chown -R $USER:$USER '/home/zegkreist/Documents/Pessoal/plex_server/music/Wo Fat'");
  } catch (error) {
    console.error("\n❌ Erro no teste real:", error.message);
    console.error(error.stack);
  }
}

testRealWoFatSafe();
