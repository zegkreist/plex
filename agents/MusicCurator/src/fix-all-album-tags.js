/**
 * fix-all-album-tags.js
 *
 * Percorre TODA a biblioteca (curada ou não) e corrige as tags de áudio sempre
 * que a tag ALBUM embedada no arquivo NÃO corresponder ao nome da pasta do álbum.
 *
 * Útil para corrigir arquivos importados de compilações (ex: "Viagem light")
 * ou de qualquer fonte onde a tag ALBUM estava errada.
 *
 * Uso:
 *   node src/fix-all-album-tags.js [--dry-run] [--artist "Nome"]
 *
 * Flags:
 *   --dry-run     Apenas lista o que seria corrigido, sem alterar arquivos
 *   --artist X    Processa apenas o artista especificado (nome exato da pasta)
 */

import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { AlbumConsolidator } from "./album-consolidator.js";

dotenv.config();

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLEX_SERVER_ROOT = path.resolve(__dirname, "../..");

const MUSIC_PATH = process.env.MUSIC_PATH || path.join(PLEX_SERVER_ROOT, "music");
const MUSIC_EXTS = new Set([".flac", ".mp3", ".m4a", ".ogg", ".wav", ".aiff", ".opus", ".wma"]);

// ─── Parse de argumentos ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const artistFilter = (() => {
  const idx = args.indexOf("--artist");
  return idx !== -1 ? args[idx + 1] : null;
})();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Lê a tag ALBUM embedada no arquivo via ffprobe.
 * Retorna string vazia se não encontrar.
 */
async function readAlbumTag(filePath) {
  try {
    const { stdout } = await execFileAsync("ffprobe", ["-v", "quiet", "-print_format", "json", "-show_format", filePath], { timeout: 10000 });
    const tags = JSON.parse(stdout)?.format?.tags ?? {};
    return tags.ALBUM ?? tags.album ?? "";
  } catch {
    return "";
  }
}

/**
 * Deriva o título esperado do álbum a partir do nome da pasta:
 * remove conteúdo em [] e () e normaliza espaços.
 */
function expectedAlbumTitle(folderName) {
  return folderName
    .replace(/\s*\[[^\]]+\]/g, "") // [CURATED], [FLAC], [MP4], etc.
    .replace(/\s*\([^)]+\)/g, "") // (2020), (Remastered), (Deluxe), etc.
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normaliza duas strings para comparação (case-insensitive, sem espaços duplos).
 */
function normalize(str) {
  return (str ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🏷️  Fix All Album Tags");
  console.log("=".repeat(70));
  console.log(`📂 Biblioteca: ${MUSIC_PATH}`);
  console.log(`🔍 Modo: ${DRY_RUN ? "DRY-RUN (sem alterações)" : "REAL (arquivos serão modificados)"}`);
  if (artistFilter) console.log(`🎤 Filtro artista: "${artistFilter}"`);
  console.log("=".repeat(70));

  const consolidator = new AlbumConsolidator(null);

  const stats = {
    artists: 0,
    albums: 0,
    albumsAlreadyCorrect: 0,
    tracksFixed: 0,
    tracksFailed: 0,
    tracksAlreadyCorrect: 0,
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

    let albumEntries;
    try {
      albumEntries = await fs.readdir(artistPath, { withFileTypes: true });
    } catch {
      continue;
    }

    const albumDirs = albumEntries.filter((e) => e.isDirectory());
    let artistPrinted = false;

    for (const albumEntry of albumDirs) {
      const albumPath = path.join(artistPath, albumEntry.name);
      const albumName = albumEntry.name;
      const expectedTitle = expectedAlbumTitle(albumName);

      if (!expectedTitle) continue; // pasta sem nome útil

      // Lê todos os arquivos de música do álbum
      let files;
      try {
        const entries = await fs.readdir(albumPath, { withFileTypes: true });
        files = entries.filter((e) => e.isFile() && MUSIC_EXTS.has(path.extname(e.name).toLowerCase())).map((e) => path.join(albumPath, e.name));
      } catch {
        continue;
      }

      if (files.length === 0) continue;

      // Verifica quantos arquivos têm a tag errada — sem ler todos se estiver certo
      const wrongFiles = [];
      for (const filePath of files) {
        const current = await readAlbumTag(filePath);
        if (normalize(current) !== normalize(expectedTitle)) {
          wrongFiles.push({ filePath, current });
        } else {
          stats.tracksAlreadyCorrect++;
        }
      }

      if (wrongFiles.length === 0) {
        stats.albumsAlreadyCorrect++;
        continue;
      }

      // Imprime artista na primeira ocorrência com problema
      if (!artistPrinted) {
        console.log(`\n🎤 ${artistName}`);
        stats.artists++;
        artistPrinted = true;
      }

      // Coleta os valores de ALBUM errôneos para o log (mostra apenas os únicos)
      const wrongAlbumValues = [...new Set(wrongFiles.map((w) => w.current || "(vazia)"))];
      console.log(`  📀 "${albumName}"`);
      console.log(`     ❌ Tag atual:   ${wrongAlbumValues.join(" | ") || "(vazia)"}`);
      console.log(`     ✅ Tag correta: "${expectedTitle}"`);
      console.log(`     📁 ${wrongFiles.length} faixa(s) incorreta(s) de ${files.length}`);

      stats.albums++;

      if (DRY_RUN) {
        stats.tracksFixed += wrongFiles.length; // conta como "seriam corrigidas"
        continue;
      }

      // Usa updateAlbumTags para corrigir — reescreve ALBUM para todas as faixas
      // (re-ordena numeração pelo nome do arquivo para manter TRACKNUMBER consistente)
      const result = await consolidator.updateAlbumTags(albumPath, albumName, artistName);
      stats.tracksFixed += result.updated ?? 0;
      stats.tracksFailed += result.failed ?? 0;
    }
  }

  // ─── Relatório final ────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(70));
  console.log("📊 RELATÓRIO FINAL");
  console.log("=".repeat(70));
  console.log(`🎤 Artistas com problemas:   ${stats.artists}`);
  console.log(`📀 Álbuns corrigidos:         ${stats.albums}`);
  console.log(`✅ Álbuns já corretos:        ${stats.albumsAlreadyCorrect}`);
  console.log(`🏷️  Faixas ${DRY_RUN ? "a corrigir" : "corrigidas"}:       ${stats.tracksFixed}`);
  console.log(`✅ Faixas já corretas:         ${stats.tracksAlreadyCorrect}`);
  if (stats.tracksFailed > 0) {
    console.log(`❌ Faixas com falha:           ${stats.tracksFailed}`);
  }

  if (DRY_RUN) {
    console.log("\n💡 Execute sem --dry-run para aplicar as alterações.");
  } else {
    console.log("\n✅ Concluído! Faça um 'Scan Library Files' no Plex para refletir as mudanças.");
  }
}

// ESM main-module guard
if (process.argv[1] === __filename) {
  main().catch((err) => {
    console.error("💥 ERRO FATAL:", err.message);
    process.exit(1);
  });
}

export { main, expectedAlbumTitle };
