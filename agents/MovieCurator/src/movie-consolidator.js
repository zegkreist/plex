import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/** Extensions considered video files */
const VIDEO_EXTS = new Set([".mkv", ".mp4", ".avi", ".m4v", ".mov", ".wmv"]);

/** Quality/codec tags that appear after year in torrent filenames */
const QUALITY_PATTERN =
  /\b(1080p|720p|480p|2160p|4K|4k|BluRay|Blu-Ray|WEB-DL|WEBRip|HDRip|HDTV|DVDRip|x264|x265|HEVC|AVC|AAC|DTS|AC3|DD5\.1|YIFY|RARBG|GalaxyTV|TGx|XviD|H\.264|H\.265|Remux|HDR|SDR).*$/i;

export class MovieConsolidator {
  /**
   * @param {object|null} allFather  AllFather instance (may be null for dry-run / testing)
   */
  constructor(allFather = null) {
    this.allFather = allFather;
  }

  // ─── parseMovieFilename() ─────────────────────────────────────────────────

  /**
   * Parses a movie filename into structured data.
   *
   * Handles:
   *  - Plex-formatted:  "Movie Name (Year).ext"
   *  - Plex with ID:    "Movie Name (Year) {imdb-ttXXX}.ext"
   *  - Dot-separated:   "Movie.Name.Year.1080p.mkv"
   *  - Underscore:      "Movie_Name_Year_1080p.mkv"
   *  - With brackets:   "Movie Name [Year].mkv"
   *  - No year:         "Movie Name.mkv"
   *
   * @param {string} filename
   * @returns {{title: string, year: string|null, imdbId: string|null, tmdbId: string|null, ext: string}|null}
   */
  parseMovieFilename(filename) {
    if (!filename) return null;

    const ext = path.extname(filename).toLowerCase();
    if (!VIDEO_EXTS.has(ext)) return null;

    let base = path.basename(filename, ext);

    // ── Extract {imdb-ttXXX} and {tmdb-XXX} tags ───────────────────────────
    let imdbId = null;
    let tmdbId = null;

    const imdbMatch = base.match(/\{imdb-(tt\d+)\}/i);
    if (imdbMatch) {
      imdbId = imdbMatch[1];
      base = base.replace(imdbMatch[0], "").trim();
    }

    const tmdbMatch = base.match(/\{tmdb-(\d+)\}/i);
    if (tmdbMatch) {
      tmdbId = tmdbMatch[1];
      base = base.replace(tmdbMatch[0], "").trim();
    }

    // ── Detect if dot/underscore-separated (no spaces at all) ─────────────
    const isDotSeparated = !base.includes(" ");

    // ── Extract year ───────────────────────────────────────────────────────
    // Supports: (2009), [2009], 2009 (plain, after dots/spaces)
    const yearMatch = base.match(/[\[\(](\d{4})[\]\)]|(?:^|[\s._])(\d{4})(?:[\s._]|$)/);
    let year = null;
    let yearIndex = -1;

    if (yearMatch) {
      year = yearMatch[1] || yearMatch[2];
      yearIndex = yearMatch.index;
      // Validate range 1888–2100
      const y = parseInt(year, 10);
      if (y < 1888 || y > 2100) {
        year = null;
        yearIndex = -1;
      }
    }

    // ── Extract title (everything before year) ─────────────────────────────
    let title = yearIndex >= 0 ? base.substring(0, yearIndex) : base;

    // Remove quality tags that may appear without a year
    title = title.replace(QUALITY_PATTERN, "");

    // If dot/underscore-separated, replace dots and underscores with spaces
    if (isDotSeparated) {
      title = title.replace(/[._]/g, " ");
    }

    // Remove trailing separators: spaces, dashes, dots
    title = title.replace(/[\s.\-–_]+$/, "");
    // Collapse whitespace
    title = title.replace(/\s+/g, " ").trim();

    if (!title) return null;

    return { title, year, imdbId, tmdbId, ext };
  }

  // ─── _cleanMovieName() ────────────────────────────────────────────────────

  /**
   * Strips technical [] tags, normalizes whitespace.
   * Content inside () and {} is preserved verbatim.
   */
  _cleanMovieName(raw) {
    // Remove [] tags
    let result = raw.replace(/\s*\[[^\]]*\]/g, "");
    return result.replace(/\s+/g, " ").trim();
  }

  // ─── normalizeMovieName() ─────────────────────────────────────────────────

  /**
   * Strips [] tags, normalizes whitespace, applies Title Case.
   */
  normalizeMovieName(name) {
    let result = this._cleanMovieName(name);
    // Remove existing (YYYY) before title-casing
    const yearMatch = result.match(/\((\d{4})\)/);
    const year = yearMatch ? yearMatch[1] : null;
    if (year) {
      result = result.replace(/\s*\(\d{4}\)/, "").trim();
    }
    // Apply Title Case (words outside {} are cased; {} preserved)
    result = result.replace(/(\{[^}]+\}|[^\s{]+)/g, (tok) => {
      if (tok.startsWith("{")) return tok;
      return tok.charAt(0).toUpperCase() + tok.slice(1).toLowerCase();
    });
    result = result.replace(/\s+/g, " ").trim();
    if (year) result = `${result} (${year})`;
    return result;
  }

  // ─── extractYearFromName() ────────────────────────────────────────────────

  /**
   * Returns the 4-digit year string from "(YYYY)" in a name, or null.
   */
  extractYearFromName(name) {
    const match = name.match(/\((\d{4})\)/);
    if (!match) return null;
    const year = parseInt(match[1], 10);
    return year >= 1888 && year <= 2100 ? match[1] : null;
  }

  // ─── toPlexMovieName() ────────────────────────────────────────────────────

  /**
   * Formats a canonical Plex movie name: "Title (YYYY)".
   * Applies Title Case. Avoids duplicating the year.
   *
   * This is also used as the folder name (Plex standard).
   */
  toPlexMovieName(title, year) {
    // Strip existing year from title
    const existingYear = this.extractYearFromName(title);
    const rawTitle = title.replace(/\s*\(\d{4}\)/g, "").trim();
    // Normalize (Title Case, strip [] tags)
    const cleanTitle = this.normalizeMovieName(rawTitle);
    const effectiveYear = year || existingYear;
    return effectiveYear ? `${cleanTitle} (${effectiveYear})` : cleanTitle;
  }

  // ─── toPlexMovieFilename() ────────────────────────────────────────────────

  /**
   * Generates a Plex-formatted movie filename.
   *
   * Format: "Movie Name (Year).ext"
   * With ID: "Movie Name (Year) {imdb-ttXXX}.ext"
   *
   * Plex prefers {imdb-} over {tmdb-}. When both are present, imdb wins.
   */
  toPlexMovieFilename({ title, year, imdbId = null, tmdbId = null, ext }) {
    const base = this.toPlexMovieName(title, year);
    let name = base;
    if (imdbId) {
      name += ` {imdb-${imdbId}}`;
    } else if (tmdbId) {
      name += ` {tmdb-${tmdbId}}`;
    }
    return `${name}${ext}`;
  }

  // ─── scanMoviesDirectory() ────────────────────────────────────────────────

  /**
   * Scans a movies root directory and returns an array of movie objects.
   *
   * Expected structures:
   *   movies/
   *     Movie Name (Year)/          ← Plex-organised folder
   *       Movie Name (Year).mkv
   *     Movie.Name.Year.1080p.mkv   ← loose file (not yet organised)
   *
   * @param {string} moviesPath  Root folder containing movie files/folders.
   * @returns {Promise<Array<{name: string, path: string, files: string[], isCurated: boolean, isLoose: boolean}>>}
   */
  async scanMoviesDirectory(moviesPath) {
    const entries = await fs.readdir(moviesPath, { withFileTypes: true });
    const movies = [];

    for (const entry of entries) {
      const entryPath = path.join(moviesPath, entry.name);

      if (entry.isDirectory()) {
        // Organised movie folder
        const subEntries = await fs.readdir(entryPath, { withFileTypes: true });
        const videoFiles = subEntries
          .filter((e) => e.isFile() && VIDEO_EXTS.has(path.extname(e.name).toLowerCase()))
          .map((e) => path.join(entryPath, e.name));

        if (videoFiles.length === 0) continue;

        const isCurated = subEntries.some((e) => e.name === ".curated");

        movies.push({
          name: entry.name,
          path: entryPath,
          files: videoFiles,
          isCurated,
          isLoose: false,
        });
      } else if (entry.isFile() && VIDEO_EXTS.has(path.extname(entry.name).toLowerCase())) {
        // Loose video file not yet in its own folder
        movies.push({
          name: entry.name,
          path: entryPath,
          files: [entryPath],
          isCurated: false,
          isLoose: true,
        });
      }
    }

    return movies;
  }

  // ─── consolidateMoviesDirectory() ──────────────────────────────────────────

  /**
   * Scans a movies directory, renames folder + file to Plex format,
   * and writes a .curated marker.
   *
   * @param {string} moviesPath
   * @param {{dryRun?: boolean, skipCurated?: boolean}} opts
   * @returns {Promise<{renamed: number, skipped: number, errors: string[]}>}
   */
  async consolidateMoviesDirectory(moviesPath, { dryRun = false, skipCurated = false } = {}) {
    const movies = await this.scanMoviesDirectory(moviesPath);
    const errors = [];
    let renamed = 0;
    let skipped = 0;

    for (const movie of movies) {
      if (skipCurated && movie.isCurated) {
        skipped++;
        continue;
      }

      try {
        await this._consolidateMovie(movie, moviesPath, { dryRun });
        renamed++;
      } catch (err) {
        errors.push(`${movie.name}: ${err.message}`);
      }
    }

    return { renamed, skipped, errors };
  }

  /**
   * Organises a single movie entry into Plex folder/file format.
   * @private
   */
  async _consolidateMovie(movie, moviesPath, { dryRun = false } = {}) {
    // Use the principal video file to parse info
    const principalFile = movie.files[0];
    const parsed = this.parseMovieFilename(path.basename(principalFile));

    // Fallback: derive title from folder/file name when parse fails
    const title = parsed ? parsed.title : movie.name.replace(/\.[^.]+$/, "");
    const year = parsed ? parsed.year : this.extractYearFromName(movie.name);
    const imdbId = parsed ? parsed.imdbId : null;
    const tmdbId = parsed ? parsed.tmdbId : null;
    const ext = parsed ? parsed.ext : path.extname(principalFile).toLowerCase();

    const plexName = this.toPlexMovieName(title, year);
    const plexFilename = this.toPlexMovieFilename({ title, year, imdbId, tmdbId, ext });

    const targetFolderPath = path.join(moviesPath, plexName);

    if (!dryRun) {
      // Ensure target folder exists
      await fs.mkdir(targetFolderPath, { recursive: true });

      if (movie.isLoose) {
        // Move loose file into new folder
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
