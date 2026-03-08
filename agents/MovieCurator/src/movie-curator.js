/**
 * MovieCurator
 *
 * High-level orchestrator that drives the full movie curation pipeline:
 *  1. Scan movies directory
 *  2. Query AllFather for canonical movie metadata (optional)
 *  3. Rename movie folder to Plex format
 *  4. Rename movie file to Plex format (with optional IMDB/TMDB ID)
 *  5. Mark curated with .curated marker
 */

import fs from "fs/promises";
import path from "path";
import { MovieConsolidator } from "./movie-consolidator.js";

export class MovieCurator {
  /**
   * @param {string} moviesPath  Root movies directory (e.g. /mnt/plex/movies)
   * @param {object|null} allFather  AllFather instance (may be null for dry-run / testing)
   * @param {{dryRun?: boolean, skipCurated?: boolean, verbose?: boolean}} opts
   */
  constructor(moviesPath, allFather = null, opts = {}) {
    this.moviesPath = moviesPath;
    this.allFather = allFather;
    this.opts = { dryRun: false, skipCurated: false, verbose: false, ...opts };
    this.consolidator = new MovieConsolidator(allFather);
  }

  _log(...args) {
    if (this.opts.verbose) console.log("[MovieCurator]", ...args);
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

    this._log(`Starting curation of: ${this.moviesPath}  dryRun=${dryRun}`);

    const movies = await this.consolidator.scanMoviesDirectory(this.moviesPath);

    for (const movie of movies) {
      if (skipCurated && movie.isCurated) {
        this._log(`Skipping already curated: ${movie.name}`);
        skipped++;
        continue;
      }

      try {
        await this._curateMovie(movie);
        processed++;
      } catch (err) {
        errors.push(`${movie.name}: ${err.message}`);
        console.error(`[MovieCurator] Error processing "${movie.name}":`, err.message);
      }
    }

    this._log(`Done. processed=${processed} skipped=${skipped} errors=${errors.length}`);
    return { processed, skipped, errors };
  }

  async _curateMovie(movie) {
    const { dryRun } = this.opts;

    // ── Step 1: Parse filename to get initial title/year ──────────────────
    const principalFile = movie.files[0];
    const parsed = this.consolidator.parseMovieFilename(path.basename(principalFile));

    let title = parsed ? parsed.title : movie.name.replace(/\.[^.]+$/, "");
    let year = parsed ? parsed.year : this.consolidator.extractYearFromName(movie.name);
    let imdbId = parsed ? parsed.imdbId : null;
    let tmdbId = parsed ? parsed.tmdbId : null;
    const ext = parsed ? parsed.ext : path.extname(principalFile).toLowerCase();

    // ── Step 2: Resolve canonical metadata from AllFather ─────────────────
    if (this.allFather) {
      try {
        const meta = await this.allFather.getMovieMetadata(title);
        if (meta && meta.title) {
          title = meta.title;
          year = meta.year || year;
          imdbId = meta.imdbId || imdbId;
          tmdbId = meta.tmdbId || tmdbId;
        }
      } catch {
        // AllFather unavailable — proceed with filename-derived info
      }
    }

    const plexName = this.consolidator.toPlexMovieName(title, year);
    const plexFilename = this.consolidator.toPlexMovieFilename({ title, year, imdbId, tmdbId, ext });

    this._log(`${movie.name}  →  ${plexName}/${plexFilename}`);

    if (!dryRun) {
      const targetFolderPath = path.join(this.moviesPath, plexName);

      // Ensure target folder exists
      await fs.mkdir(targetFolderPath, { recursive: true });

      if (movie.isLoose) {
        // Move loose file into new Plex folder
        const destFile = path.join(targetFolderPath, plexFilename);
        await fs.rename(movie.path, destFile);
      } else {
        // Rename the file inside the folder
        const destFile = path.join(movie.path, plexFilename);
        if (principalFile !== destFile) {
          await fs.rename(principalFile, destFile);
        }
        // Rename the folder if needed
        if (movie.path !== targetFolderPath) {
          await fs.rename(movie.path, targetFolderPath);
        }
      }

      // Write .curated marker
      await fs.writeFile(
        path.join(targetFolderPath, ".curated"),
        JSON.stringify({ curatedAt: new Date().toISOString(), movie: plexName, year })
      );
    }
  }
}
