import dotenv from "dotenv";
import { AlbumConsolidator } from "../src/album-consolidator.js";
import fs from "fs/promises";
import path from "path";

dotenv.config();

/**
 * Script para testar se álbuns com tag [CURATED] são identificados como já processados
 */
async function testCuratedDetection() {
  try {
    console.log("🧪 Teste de Detecção de Álbuns Curados");
    console.log("=".repeat(60));

    const consolidator = new AlbumConsolidator();

    // Cria um diretório temporário para teste
    const testDir = "/tmp/test-curated";
    const artistDir = path.join(testDir, "Wo Fat");

    // Limpa diretório de teste se existir
    try {
      await fs.rmdir(testDir, { recursive: true });
    } catch (e) {
      // Ignora erro se não existir
    }

    // Cria estrutura de teste
    await fs.mkdir(artistDir, { recursive: true });

    // Álbum SEM tag [CURATED]
    const album1 = path.join(artistDir, "The Singularity (2022)");
    await fs.mkdir(album1, { recursive: true });

    // Álbum COM tag [CURATED]
    const album2 = path.join(artistDir, "Orphans Of The Singe (2022) [CURATED]");
    await fs.mkdir(album2, { recursive: true });

    console.log("📂 Estrutura de teste criada:");
    console.log(`   - ${album1}`);
    console.log(`   - ${album2}`);

    console.log("\n🔍 Escaneando diretório do artista...");
    const albums = await consolidator.scanArtistDirectory(artistDir, "Wo Fat");

    console.log(`\n📀 Álbuns encontrados: ${albums.length}`);
    albums.forEach((album) => {
      const curatedMark = album.isCurated ? "✓ CURADO" : " NÃO CURADO";
      console.log(`   [${curatedMark}] ${album.name}`);
    });

    // Verifica resultados
    const albumWithoutTag = albums.find((a) => a.name === "The Singularity (2022)");
    const albumWithTag = albums.find((a) => a.name === "Orphans Of The Singe (2022) [CURATED]");

    console.log("\n📊 Resultados:");
    console.log(`   Álbum sem tag [CURATED]: ${albumWithoutTag?.isCurated ? "INCORRETO - marcado como curado" : "CORRETO - não curado"}`);
    console.log(`   Álbum com tag [CURATED]: ${albumWithTag?.isCurated ? "CORRETO - marcado como curado" : "INCORRETO - não marcado como curado"}`);

    // Limpa diretório de teste
    try {
      await fs.rmdir(testDir, { recursive: true });
    } catch (e) {
      console.warn("⚠️  Não foi possível limpar diretório de teste:", e.message);
    }

    console.log("\n✅ Teste concluído!");
  } catch (error) {
    console.error("❌ Erro no teste:", error);
  }
}

testCuratedDetection();
