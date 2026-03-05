#!/usr/bin/env node
/**
 * fix-series-tags.js
 *
 * Standalone script to retroactively write embedded video tags (ffmpeg, no
 * re-encode) for all series that are already curated (folder name contains
 * [CURATED] or has a .curated marker file).
 *
 * Usage:
 *   node src/fix-series-tags.js [options]
 *
 * Options:
 *   --dry-run      Print what would be done without changing files
 *   --series "Name"  Process only the named series
 *
 * Environment:
 *   SERIES_PATH   Override the default TV path (defaults to ../../tv)
 */

import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { SeriesConsolidator } from "./series-consolidator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Parse CLI arguments ─────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const seriesFilter = (() => {
  const idx = args.indexOf("--series");
  return idx !== -1 ? args[idx + 1] : null;
})();

// ── Resolve TV path ──────────────────────────────────────────────────────────
const tvPath = process.env.SERIES_PATH || path.resolve(__dirname, "../../..", "tv");

async function isCurated(seriesPath) {
  // Curated by .curated file
  try {
    await fs.access(path.join(seriesPath, ".curated"));
    return true;
  } catch {}
  // Curated by [CURATED] in folder name
  return path.basename(seriesPath).includes("[CURATED]");
}

async function main() {
  console.log(`\n📺 fix-series-tags — TV path: ${tvPath}`);
  if (dryRun) console.log("   [DRY RUN — no files will be modified]\n");

  const consolidator = new SeriesConsolidator(null);
  const series = await consolidator.scanSeriesDirectory(tvPath);

  let totalShows = 0;
  let totalEpisodes = 0;
  let totalUpdated = 0;

  for (const show of series) {
    // Filter by series name if requested
    if (seriesFilter && !show.name.toLowerCase().includes(seriesFilter.toLowerCase())) {
      continue;
    }

    // Only process curated series
    if (!(await isCurated(show.path))) continue;

    totalShows++;
    const plexName = consolidator.toPlexSeriesName(
      show.name
        .replace(/\s*\[[^\]]*\]/g, "")
        .replace(/\s*\(\d{4}\)/g, "")
        .trim(),
      consolidator.extractYearFromName(show.name),
    );
    const year = consolidator.extractYearFromName(show.name);

    console.log(`📁 ${show.name}`);

    for (const season of show.seasons) {
      for (const ep of season.episodes) {
        totalEpisodes++;
        const parsed = consolidator.parseEpisodeFilename(ep.name);
        if (!parsed) {
          console.log(`   ⚠️  Cannot parse: ${ep.name}`);
          continue;
        }

        if (dryRun) {
          console.log(`   [dry] ${ep.name} → show="${plexName}" season=${season.number} episode=${parsed.episode}`);
        } else {
          try {
            await consolidator.updateEpisodeTags(ep.path, {
              show: plexName,
              season: season.number,
              episode: parsed.episode,
              title: parsed.title,
              year,
            });
            totalUpdated++;
            console.log(`   ✅ ${ep.name}`);
          } catch (err) {
            console.error(`   ❌ ${ep.name}: ${err.message}`);
          }
        }
      }
    }
  }

  console.log(`\n✨ Done. shows=${totalShows} episodes=${totalEpisodes}` + (!dryRun ? ` updated=${totalUpdated}` : " (dry run)"));
}

// ESM main-module guard
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
}

export { main };
