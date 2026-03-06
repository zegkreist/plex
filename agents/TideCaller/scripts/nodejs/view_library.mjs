#!/usr/bin/env node
/**
 * Visualizador da biblioteca enriquecida
 * Mostra estatísticas sobre artistas, álbuns completos/incompletos
 */

import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..", "..");

/**
 * Formata bytes para formato legível
 */
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Função principal
 */
async function main() {
  const inputFile = join(PROJECT_ROOT, "library_enriched.json");

  console.log("=".repeat(70));
  console.log("🎵 VISUALIZADOR DE BIBLIOTECA - MusicBrainz Enriched");
  console.log("=".repeat(70));
  console.log();

  // Carregar dados
  console.log(`📖 Carregando ${inputFile}...`);
  const data = JSON.parse(await readFile(inputFile, "utf-8"));

  // Estatísticas gerais
  console.log();
  console.log("📊 ESTATÍSTICAS GERAIS");
  console.log("-".repeat(70));
  console.log(`Total de faixas: ${data.metadata.total_tracks}`);
  console.log(`Encontradas no MusicBrainz: ${data.metadata.found} (${Math.round((data.metadata.found / data.metadata.total_tracks) * 100)}%)`);
  console.log(`Não encontradas: ${data.metadata.not_found} (${Math.round((data.metadata.not_found / data.metadata.total_tracks) * 100)}%)`);
  console.log(`Requests feitos: ${data.metadata.requests_made}`);
  console.log(`Total de álbuns: ${data.albums.length}`);
  console.log(`Singles/EPs: ${data.singles.length}`);
  console.log();

  // Análise por artista
  const artistStats = {};

  for (const album of data.albums) {
    if (!artistStats[album.artist]) {
      artistStats[album.artist] = {
        total_tracks: 0,
        albums: 0,
        complete_albums: 0,
        incomplete_albums: 0,
      };
    }

    artistStats[album.artist].total_tracks += album.downloaded_tracks;
    artistStats[album.artist].albums++;

    if (album.is_complete === true) {
      artistStats[album.artist].complete_albums++;
    } else if (album.is_complete === false) {
      artistStats[album.artist].incomplete_albums++;
    }
  }

  // Adicionar singles
  for (const single of data.singles) {
    if (!artistStats[single.artist]) {
      artistStats[single.artist] = {
        total_tracks: 0,
        albums: 0,
        complete_albums: 0,
        incomplete_albums: 0,
      };
    }
    artistStats[single.artist].total_tracks++;
  }

  // Top artistas por número de músicas
  const topArtists = Object.entries(artistStats)
    .sort((a, b) => b[1].total_tracks - a[1].total_tracks)
    .slice(0, 20);

  console.log("🎤 TOP 20 ARTISTAS (por número de faixas)");
  console.log("-".repeat(70));
  topArtists.forEach(([artist, stats], index) => {
    const albums = stats.albums > 0 ? ` • ${stats.albums} álbuns` : "";
    const complete = stats.complete_albums > 0 ? ` (${stats.complete_albums} completos)` : "";
    const incomplete = stats.incomplete_albums > 0 ? ` (${stats.incomplete_albums} incompletos)` : "";

    console.log(`${(index + 1).toString().padStart(2, " ")}. ${artist}`);
    console.log(`    └─ ${stats.total_tracks} faixas${albums}${complete}${incomplete}`);
  });

  console.log();

  // Álbuns incompletos - ordenados por percentual de completude (maior para menor)
  const incompleteAlbums = data.albums
    .filter((a) => a.is_complete === false && a.expected_tracks > 0)
    .map((a) => ({
      ...a,
      completeness: (a.downloaded_tracks / a.expected_tracks) * 100,
    }))
    .sort((a, b) => b.completeness - a.completeness);

  if (incompleteAlbums.length > 0) {
    console.log("📀 ÁLBUNS INCOMPLETOS (ordenados por % de completude)");
    console.log("-".repeat(70));

    // Álbuns quase completos (>= 75%)
    const almostComplete = incompleteAlbums.filter((a) => a.completeness >= 75);
    if (almostComplete.length > 0) {
      console.log();
      console.log("⭐ Álbuns quase completos (>= 75%):");
      console.log();
      almostComplete.slice(0, 15).forEach((album) => {
        const percent = album.completeness.toFixed(1);
        console.log(`• ${album.artist} - ${album.album_name}`);
        console.log(`  └─ ${album.downloaded_tracks}/${album.expected_tracks} faixas (${percent}%) - faltam ${album.missing_tracks}`);
      });
      if (almostComplete.length > 15) {
        console.log(`  ... e mais ${almostComplete.length - 15} álbuns`);
      }
    }

    // Álbuns mediamente completos (50-75%)
    const mediumComplete = incompleteAlbums.filter((a) => a.completeness >= 50 && a.completeness < 75);
    if (mediumComplete.length > 0) {
      console.log();
      console.log("🔶 Álbuns mediamente completos (50-75%):");
      console.log();
      mediumComplete.slice(0, 10).forEach((album) => {
        const percent = album.completeness.toFixed(1);
        console.log(`• ${album.artist} - ${album.album_name}`);
        console.log(`  └─ ${album.downloaded_tracks}/${album.expected_tracks} faixas (${percent}%) - faltam ${album.missing_tracks}`);
      });
      if (mediumComplete.length > 10) {
        console.log(`  ... e mais ${mediumComplete.length - 10} álbuns`);
      }
    }

    // Álbuns pouco completos (< 50%)
    const lessComplete = incompleteAlbums.filter((a) => a.completeness < 50);
    if (lessComplete.length > 0) {
      console.log();
      console.log(`🔻 Álbuns pouco completos (< 50%): ${lessComplete.length} álbuns`);
      console.log();
      lessComplete.slice(0, 5).forEach((album) => {
        const percent = album.completeness.toFixed(1);
        console.log(`• ${album.artist} - ${album.album_name}`);
        console.log(`  └─ ${album.downloaded_tracks}/${album.expected_tracks} faixas (${percent}%) - faltam ${album.missing_tracks}`);
      });
      if (lessComplete.length > 5) {
        console.log(`  ... e mais ${lessComplete.length - 5} álbuns`);
      }
    }

    console.log();
    console.log(`📊 Resumo de álbuns incompletos:`);
    console.log(`   Total: ${incompleteAlbums.length}`);
    console.log(`   Quase completos (>= 75%): ${almostComplete.length}`);
    console.log(`   Mediamente completos (50-75%): ${mediumComplete.length}`);
    console.log(`   Pouco completos (< 50%): ${lessComplete.length}`);
  } else {
    console.log("✅ Todos os álbuns identificados estão completos!");
  }

  console.log();

  // Álbuns completos
  const completeAlbums = data.albums.filter((a) => a.is_complete === true);
  if (completeAlbums.length > 0) {
    console.log("✅ ÁLBUNS COMPLETOS");
    console.log("-".repeat(70));
    console.log(`Total: ${completeAlbums.length} álbuns completos`);
    console.log();

    // Top 10 álbuns completos por número de faixas
    const topComplete = completeAlbums.sort((a, b) => b.downloaded_tracks - a.downloaded_tracks).slice(0, 10);

    console.log("Top 10 álbuns completos (por número de faixas):");
    console.log();
    topComplete.forEach((album, index) => {
      console.log(`${(index + 1).toString().padStart(2, " ")}. ${album.artist} - ${album.album_name}`);
      console.log(`    └─ ${album.downloaded_tracks} faixas`);
    });
  }

  console.log();
  console.log("=".repeat(70));
}

main().catch((error) => {
  console.error("❌ Erro fatal:", error);
  process.exit(1);
});
