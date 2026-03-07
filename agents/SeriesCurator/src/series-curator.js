/**
 * SeriesCurator
 *
 * High-level orchestrator that drives the full TV curation pipeline:
 *  1. Scan TV directory
 *  2. Query AllFather for canonical series metadata
 *  3. Rename series folders to Plex format
 *  4. Rename episode files to Plex format
 *  5. Write embedded video tags (ffmpeg, no re-encode)
 *  6. Mark curated with .curated marker
 */

import fs from "fs/promises";
import path from "path";
import { SeriesConsolidator } from "./series-consolidator.js";

export class SeriesCurator {
  /**
   * @param {string} tvPath   Root TV directory (e.g. /mnt/plex/tv)
   * @param {object} allFather  AllFather instance (may be null for dry-run / testing)
   * @param {{dryRun?: boolean, skipCurated?: boolean, verbose?: boolean}} opts
   */
  constructor(tvPath, allFather = null, opts = {}) {
    this.tvPath = tvPath;
    this.allFather = allFather;
    this.opts = { dryRun: false, skipCurated: false, verbose: false, ...opts };
    this.consolidator = new SeriesConsolidator(allFather);
  }

  _log(...args) {
    if (this.opts.verbose) console.log("[SeriesCurator]", ...args);
  }

  /**
   * Runs the full curation pipeline.
   * @returns {Promise<{processed: number, skipped: number, errors: string[]}>}
   */
  async curate() {
    const { dryRun, skipCurated } = this.opts;
    const errors = [];
    let processed = 0;
    let skipped = 0;

    this._log(`Starting curation of: ${this.tvPath}  dryRun=${dryRun}`);

    const series = await this.consolidator.scanSeriesDirectory(this.tvPath);

    for (const show of series) {
      if (skipCurated && show.isCurated) {
        this._log(`Skipping already curated: ${show.name}`);
        skipped++;
        continue;
      }

      try {
        await this._curateShow(show);
        processed++;
      } catch (err) {
        errors.push(`${show.name}: ${err.message}`);
        console.error(`[SeriesCurator] Error processing "${show.name}":`, err.message);
      }
    }

    this._log(`Done. processed=${processed} skipped=${skipped} errors=${errors.length}`);
    return { processed, skipped, errors };
  }

  async _curateShow(show) {
    const { dryRun } = this.opts;

    // ── Step 1: Resolve canonical metadata ─────────────────────────────────
    let canonicalTitle = show.name
      .replace(/\s*\[[^\]]*\]/g, "")
      .replace(/\s*\(\d{4}\)/g, "")
      .trim();
    let year = this.consolidator.extractYearFromName(show.name);

    if (this.allFather) {
      try {
        const meta = await this.allFather.getSeriesMetadata(canonicalTitle);
        if (meta && meta.title) {
          canonicalTitle = meta.title;
          year = meta.year || year;
        }
      } catch {
        // AllFather unavailable — proceed with folder-derived name
      }
    }

    const plexShowName = this.consolidator.toPlexSeriesName(canonicalTitle, year);
    this._log(`${show.name}  →  ${plexShowName}`);

    // ── Step 2: Rename series folder ────────────────────────────────────────
    const newSeriesPath = path.join(this.tvPath, plexShowName);
    let currentSeriesPath = show.path;

    if (!dryRun && currentSeriesPath !== newSeriesPath) {
      await fs.rename(currentSeriesPath, newSeriesPath);
      currentSeriesPath = newSeriesPath;
    }

    // ── Step 3: Rename episodes + write tags in each season ─────────────────
    // Re-scan to get fresh paths after potential folder rename
    const seasonDirs = await fs.readdir(currentSeriesPath, { withFileTypes: true });

    for (const entry of seasonDirs) {
      if (!entry.isDirectory()) continue;
      const seasonPath = path.join(currentSeriesPath, entry.name);
      const { number: seasonNum } = this.consolidator._parseSeasonDirName(entry.name);
      if (seasonNum < 0) continue;

      // Rename episodes
      const renameResult = await this.consolidator.renameSeasonEpisodes(seasonPath, canonicalTitle, year, { dryRun });
      this._log(`  ${entry.name}: renamed=${renameResult.renamed} skipped=${renameResult.skipped}`);

      // Write tags (skip in dry-run, handled by updateEpisodeTags itself)
      if (!dryRun) {
        const episodes = await this.consolidator._scanEpisodes(seasonPath);
        for (const ep of episodes) {
          const parsed = this.consolidator.parseEpisodeFilename(ep.name);
          if (!parsed) continue;
          await this.consolidator
            .updateEpisodeTags(ep.path, {
              show: plexShowName,
              season: seasonNum,
              episode: parsed.episode,
              title: parsed.title,
              year,
            })
            .catch((e) => {
              this._log(`  Tag write failed for ${ep.name}: ${e.message}`);
            });
        }
      }
    }

    // ── Step 4: Mark as curated ─────────────────────────────────────────────
    if (!dryRun) {
      await fs.writeFile(path.join(currentSeriesPath, ".curated"), JSON.stringify({ curatedAt: new Date().toISOString(), show: plexShowName, year }));
    }
  }
}
