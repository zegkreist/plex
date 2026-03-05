/**
 * fix-curated-tags.js
 *
 * Percorre toda a biblioteca e atualiza as tags de áudio (ALBUM, ALBUMARTIST, DATE, TRACKNUMBER)
 * de todos os álbuns já curados — pastas com "[CURATED]" no nome ou arquivo ".curated" dentro.
 *
 * Uso:
 *   node src/fix-curated-tags.js [--dry-run] [--artist "Nome do Artista"]
 *
 * Flags:
 *   --dry-run     Apenas simula, não altera nenhum arquivo
 *   --artist X    Processa apenas o artista especificado
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { AlbumConsolidator } from "./album-consolidator.js";

dotenv.config();

const MUSIC_PATH = process.env.MUSIC_PATH || "/home/zegkreist/Documents/Pessoal/plex_server/music";

// ─── Parse de argumentos ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const artistFilter = (() => {
  const idx = args.indexOf("--artist");
  return idx !== -1 ? args[idx + 1] : null;
})();

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🏷️  Fix Curated Tags");
  console.log("=".repeat(70));
  console.log(`📂 Biblioteca: ${MUSIC_PATH}`);
  console.log(`🔍 Modo: ${DRY_RUN ? "DRY-RUN (sem alterações)" : "REAL (arquivos serão modificados)"}`);
  if (artistFilter) console.log(`🎤 Filtro artista: "${artistFilter}"`);
  console.log("=".repeat(70));

  const consolidator = new AlbumConsolidator(null);

  // Estatísticas
  const stats = {
    artists: 0,
    albums: 0,
    tracksUpdated: 0,
    tracksFailed: 0,
    albumsSkipped: 0,
  };

  // Lê artistas
  let artistEntries;
  try {
    artistEntries = await fs.readdir(MUSIC_PATH, { withFileTypes: true });
  } catch (err) {
    console.error(`❌ Não foi possível ler: ${MUSIC_PATH}\n${err.message}`);
    process.exit(1);
  }

  const artists = artistEntries
    .filter((e) => e.isDirectory())
    .filter((e) => !artistFilter || e.name === artistFilter)
    .sort((a, b) => a.name.localeCompare(b.name));

  console.log(`\n🎵 ${artists.length} artista(s) a processar\n`);

  for (const artistEntry of artists) {
    const artistPath = path.join(MUSIC_PATH, artistEntry.name);
    const artistName = artistEntry.name;

    // Lê álbuns do artista
    let albumEntries;
    try {
      albumEntries = await fs.readdir(artistPath, { withFileTypes: true });
    } catch {
      continue;
    }

    const albumDirs = albumEntries.filter((e) => e.isDirectory());
    let artistHadCurated = false;

    for (const albumEntry of albumDirs) {
      const albumPath = path.join(artistPath, albumEntry.name);
      const albumName = albumEntry.name;

      // Verifica se é curado: nome com [CURATED] ou arquivo .curated dentro
      const hasCuratedTag = albumName.includes("[CURATED]");
      let hasCuratedFile = false;
      try {
        await fs.access(path.join(albumPath, ".curated"));
        hasCuratedFile = true;
      } catch {}

      if (!hasCuratedTag && !hasCuratedFile) {
        stats.albumsSkipped++;
        continue;
      }

      if (!artistHadCurated) {
        console.log(`\n🎤 ${artistName}`);
        stats.artists++;
        artistHadCurated = true;
      }

      console.log(`  📀 "${albumName}" ${hasCuratedFile && !hasCuratedTag ? "(via .curated)" : ""}`);

      const result = await consolidator.updateAlbumTags(albumPath, albumName, artistName, {
        dryRun: DRY_RUN,
      });

      stats.albums++;
      stats.tracksUpdated += result.updated || 0;
      stats.tracksFailed += result.failed || 0;
    }
  }

  // Relatório final
  console.log("\n" + "=".repeat(70));
  console.log("📊 RELATÓRIO FINAL");
  console.log("=".repeat(70));
  console.log(`🎤 Artistas processados:  ${stats.artists}`);
  console.log(`📀 Álbuns curados:        ${stats.albums}`);
  console.log(`⏭️  Álbuns ignorados:      ${stats.albumsSkipped}`);
  console.log(`🏷️  Faixas atualizadas:   ${stats.tracksUpdated}`);
  if (stats.tracksFailed > 0) {
    console.log(`❌ Faixas com falha:      ${stats.tracksFailed}`);
  }

  if (DRY_RUN) {
    console.log("\n💡 Execute sem --dry-run para aplicar as alterações.");
  } else {
    console.log("\n✅ Tags atualizadas! Faça um 'Scan Library Files' no Plex para refletir as mudanças.");
  }
}

main().catch((err) => {
  console.error("💥 ERRO FATAL:", err.message);
  process.exit(1);
});

// Entrypoint ESM guard
const __filename = fileURLToPath(import.meta.url);
