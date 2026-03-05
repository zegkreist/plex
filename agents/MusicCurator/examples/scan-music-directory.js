import dotenv from "dotenv";
import { AllFather } from "@plex-agents/allfather";
import { AlbumConsolidator } from "../src/album-consolidator.js";

dotenv.config();

/**
 * Script simples para escanear e listar álbuns em um diretório
 *
 * USO:
 * node examples/scan-music-directory.js [caminho_para_pasta_música]
 */
async function main() {
  try {
    const musicPath = process.argv[2];

    if (!musicPath) {
      console.error("❌ Uso: node examples/scan-music-directory.js [caminho_para_pasta_música]");
      console.error("\nExemplo: node examples/scan-music-directory.js /music");
      process.exit(1);
    }

    console.log("🔍 MusicCurator - Escaneador de Biblioteca");
    console.log("=".repeat(80));

    const allfather = new AllFather();
    const consolidator = new AlbumConsolidator(allfather);

    console.log(`\n📂 Escaneando: ${musicPath}\n`);

    const artists = await consolidator.scanMusicDirectory(musicPath);

    console.log("\n" + "=".repeat(80));
    console.log("📊 RESUMO DA BIBLIOTECA");
    console.log("=".repeat(80));

    let totalAlbums = 0;
    let totalTracks = 0;
    let curatedAlbums = 0;
    let albumsWithCovers = 0;

    for (const artist of artists) {
      console.log(`\n🎤 ${artist.name}`);
      console.log(`   Álbuns: ${artist.albums.length}`);

      for (const album of artist.albums) {
        totalAlbums++;
        totalTracks += album.trackCount;
        if (album.isCurated) curatedAlbums++;
        if (album.coverPath) albumsWithCovers++;

        const curatedMark = album.isCurated ? "✓" : " ";
        const coverMark = album.coverPath ? "🎨" : "  ";

        console.log(`   ${curatedMark} ${coverMark} ${album.name} (${album.trackCount} faixas)`);
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log("📈 ESTATÍSTICAS");
    console.log("=".repeat(80));
    console.log(`🎤 Total de artistas: ${artists.length}`);
    console.log(`📀 Total de álbuns: ${totalAlbums}`);
    console.log(`🎵 Total de faixas: ${totalTracks}`);
    console.log(`✅ Álbuns curados: ${curatedAlbums}/${totalAlbums} (${((curatedAlbums / totalAlbums) * 100).toFixed(1)}%)`);
    console.log(`🎨 Álbuns com cover: ${albumsWithCovers}/${totalAlbums} (${((albumsWithCovers / totalAlbums) * 100).toFixed(1)}%)`);

    console.log("\n✅ Scan concluído!");
  } catch (error) {
    console.error("\n❌ Erro:", error.message);
    process.exit(1);
  }
}

main();
