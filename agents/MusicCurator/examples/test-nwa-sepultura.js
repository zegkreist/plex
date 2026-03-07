import dotenv from "dotenv";
import { AlbumConsolidator } from "../src/album-consolidator.js";
import fs from "fs/promises";
import path from "path";

dotenv.config();

/**
 * Teste de integração para N.W.A e Sepultura
 * Simula diretórios de artistas com álbuns curados e não curados
 */
async function testNWASepulturaIntegration() {
  try {
    console.log("🧪 Teste de Integração: N.W.A e Sepultura");
    console.log("=".repeat(60));

    const consolidator = new AlbumConsolidator();

    // Cria diretório temporário para teste
    const testDir = "/tmp/test-nwa-sepultura";
    const nwaDir = path.join(testDir, "N.W.A");
    const sepulturaDir = path.join(testDir, "Sepultura");

    // Limpa diretório de teste se existir
    try {
      await fs.rm(testDir, { recursive: true });
    } catch (e) {}

    // Cria estrutura de teste
    await fs.mkdir(nwaDir, { recursive: true });
    await fs.mkdir(sepulturaDir, { recursive: true });

    // N.W.A: 1 álbum curado, 1 não curado
    const nwaCurated = path.join(nwaDir, "Straight Outta Compton [CURATED]");
    const nwaUncurated = path.join(nwaDir, "Efil4zaggin");
    await fs.mkdir(nwaCurated, { recursive: true });
    await fs.mkdir(nwaUncurated, { recursive: true });

    // Sepultura: 1 álbum curado, 1 não curado
    const sepulturaCurated = path.join(sepulturaDir, "Roots [CURATED]");
    const sepulturaUncurated = path.join(sepulturaDir, "Arise");
    await fs.mkdir(sepulturaCurated, { recursive: true });
    await fs.mkdir(sepulturaUncurated, { recursive: true });

    console.log("📂 Estrutura de teste criada:");
    console.log(`   - N.W.A: ${nwaCurated}, ${nwaUncurated}`);
    console.log(`   - Sepultura: ${sepulturaCurated}, ${sepulturaUncurated}`);

    // Testa detecção de álbuns não curados
    console.log("\n🔍 Escaneando diretórios dos artistas...");
    const nwaAlbums = await consolidator.scanArtistDirectory(nwaDir, "N.W.A");
    const sepulturaAlbums = await consolidator.scanArtistDirectory(sepulturaDir, "Sepultura");

    console.log(`\n📀 N.W.A álbuns encontrados: ${nwaAlbums.length}`);
    nwaAlbums.forEach((album) => {
      const curatedMark = album.isCurated ? "✓ CURADO" : " NÃO CURADO";
      console.log(`   [${curatedMark}] ${album.name}`);
    });

    console.log(`\n📀 Sepultura álbuns encontrados: ${sepulturaAlbums.length}`);
    sepulturaAlbums.forEach((album) => {
      const curatedMark = album.isCurated ? "✓ CURADO" : " NÃO CURADO";
      console.log(`   [${curatedMark}] ${album.name}`);
    });

    // Verifica se detecta corretamente
    const nwaUncuratedAlbum = nwaAlbums.find((a) => a.name === "Efil4zaggin");
    const sepulturaUncuratedAlbum = sepulturaAlbums.find((a) => a.name === "Arise");

    console.log("\n📊 Resultados:");
    console.log(`   N.W.A álbum não curado: ${nwaUncuratedAlbum?.isCurated ? "INCORRETO - marcado como curado" : "CORRETO - não curado"}`);
    console.log(`   Sepultura álbum não curado: ${sepulturaUncuratedAlbum?.isCurated ? "INCORRETO - marcado como curado" : "CORRETO - não curado"}`);

    console.log("\n✅ Teste concluído!");
  } catch (error) {
    console.error("❌ Erro no teste:", error);
  }
}

testNWASepulturaIntegration();
