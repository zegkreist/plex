import fs from "fs/promises";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/** Extensions considered video files */
const VIDEO_EXTS = new Set([".mkv", ".mp4", ".avi", ".m4v", ".mov", ".wmv"]);

export class SeriesConsolidator {
  constructor(allFather = null) {
    this.allFather = allFather;
  }

  // ─── parseEpisodeFilename() ────────────────────────────────────────────────

  /**
   * Parses an episode filename into structured data.
   * Handles: Plex "ShowName - sXXeYY - Title", dot-separated "Show.S01E01",
   * multi-episode "sXXeYY-eZZ", date-based "YYYY-MM-DD", specials (s00).
   * @returns {object|null} Parsed info, or null if unrecognized.
   */
  parseEpisodeFilename(filename) {
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);

    // ── Date-based format: "Show - YYYY-MM-DD - Title" ─────────────────────
    const dateMatch = base.match(/^(.*?)[\s\-–]+(\d{4}-\d{2}-\d{2})(?:[\s\-–]+([^\[]+?))?(\s*(?:\[[^\]]*\])+)?\s*$/);
    if (dateMatch) {
      const showName = this._cleanShowName(dateMatch[1]);
      const airDate = dateMatch[2];
      const rawTitle = dateMatch[3] ? dateMatch[3].replace(/\s*\[[^\]]*\]/g, "").trim() : null;
      const title = rawTitle || null;
      const tags = this._extractTags(base);
      return {
        showName,
        season: null,
        episode: null,
        episodeEnd: null,
        title,
        tags,
        ext,
        dateBased: true,
        airDate,
        isSpecial: false,
      };
    }

    // ── Standard sXXeYY / SXXeYY format ────────────────────────────────────
    const epCode = base.match(/[sS](\d+)[eE](\d+)(?:-[eE](\d+))?/);
    if (!epCode) return null;

    const epIdx = base.indexOf(epCode[0]);
    const season = parseInt(epCode[1], 10);
    const episode = parseInt(epCode[2], 10);
    const episodeEnd = epCode[3] ? parseInt(epCode[3], 10) : null;

    const showPart = base.substring(0, epIdx);
    const showName = this._cleanShowName(showPart);

    // Everything after the episode code
    let afterEp = base.substring(epIdx + epCode[0].length);
    afterEp = afterEp.replace(/^[\s.\-–]+/, ""); // strip leading separator

    const tags = this._extractTags(afterEp);
    const titleRaw = afterEp.replace(/\s*\[[^\]]*\]/g, "").trim();
    const title = titleRaw || null;

    return {
      showName,
      season,
      episode,
      episodeEnd,
      title,
      tags,
      ext,
      dateBased: false,
      airDate: null,
      isSpecial: season === 0,
    };
  }

  /** Extracts content of all [...] brackets in a string as an array */
  _extractTags(str) {
    const matches = [...str.matchAll(/\[([^\]]+)\]/g)];
    return matches.map((m) => m[1]);
  }

  /**
   * Cleans a raw "show name" part extracted before the episode code.
   * Handles dot-separated ("Night.Sky.") and dash-terminated ("Night Sky - ") forms.
   */
  _cleanShowName(raw) {
    // Remove trailing separators: spaces, dashes, dots
    let result = raw.replace(/[\s.\-–]+$/, "");
    // If no spaces → dot-separated notation, replace dots with spaces
    if (!result.includes(" ")) {
      result = result.replace(/\./g, " ");
    }
    return result.replace(/\s+/g, " ").trim();
  }

  // ─── normalizeSeriesName() ─────────────────────────────────────────────────

  /**
   * Strips technical [] tags, normalizes whitespace, and applies Title Case.
   * Content inside () and {} is preserved verbatim (for years, (US), {tmdb-xxxx}).
   */
  normalizeSeriesName(name) {
    // Remove [] tags
    let result = name.replace(/\s*\[[^\]]*\]/g, "");
    // Collapse whitespace
    result = result.replace(/\s+/g, " ").trim();
    // Title Case words outside () and {} — parens/brace groups preserved as-is
    result = result.replace(/(\{[^}]+\}|\([^)]+\)|[^\s({]+)/g, (tok) => {
      if (tok.startsWith("{") || tok.startsWith("(")) return tok;
      return tok.charAt(0).toUpperCase() + tok.slice(1).toLowerCase();
    });
    return result.replace(/\s+/g, " ").trim();
  }

  // ─── extractYearFromName() ────────────────────────────────────────────────

  /**
   * Returns the 4-digit year string from "(YYYY)" in a name, or null.
   * Must be exactly 4 digits in the range 1900–2100.
   */
  extractYearFromName(name) {
    const match = name.match(/\((\d{4})\)/);
    if (!match) return null;
    const year = parseInt(match[1], 10);
    return year >= 1900 && year <= 2100 ? match[1] : null;
  }

  // ─── toPlexSeriesName() ───────────────────────────────────────────────────

  /**
   * Formats a canonical Plex series name: "Title (YYYY)".
   * Applies Title Case. Avoids duplicating the year.
   */
  toPlexSeriesName(title, year) {
    const existingYear = this.extractYearFromName(title);
    // Strip any existing year from title before normalizing
    const rawTitle = title.replace(/\s*\(\d{4}\)/g, "").trim();
    const cleanTitle = this.normalizeSeriesName(rawTitle);
    const effectiveYear = year || existingYear;
    return effectiveYear ? `${cleanTitle} (${effectiveYear})` : cleanTitle;
  }

  // ─── toPlexEpisodeFilename() ──────────────────────────────────────────────

  /**
   * Generates a Plex-formatted episode filename, e.g.:
   *   "Band Of Brothers (2001) - s01e01 - Currahee [1080p].mkv"
   */
  toPlexEpisodeFilename({ showName, year, season, episode, episodeEnd, title, tags, ext }) {
    const plexShow = this.toPlexSeriesName(showName, year);

    const s = String(season).padStart(2, "0");
    const e = String(episode).padStart(2, "0");
    let epCode = `s${s}e${e}`;
    if (episodeEnd != null) {
      epCode += `-e${String(episodeEnd).padStart(2, "0")}`;
    }

    let name = `${plexShow} - ${epCode}`;
    if (title) name += ` - ${title}`;
    if (tags && tags.length > 0) {
      name += " " + tags.map((t) => `[${t}]`).join(" ");
    }
    return `${name}${ext}`;
  }

  // ─── areSeriesEquivalent() ────────────────────────────────────────────────

  /**
   * Returns true if two series names refer to the same show.
   * Strips [] tags and (YYYY) year, normalizes dots/underscores to spaces,
   * but preserves (US)/(UK) style disambiguation.
   */
  areSeriesEquivalent(name1, name2) {
    const norm = (n) =>
      n
        .replace(/\s*\[[^\]]*\]/g, "") // remove [] tags
        .replace(/\s*\(\d{4}\)/g, "") // remove (YYYY)
        .replace(/[._]/g, " ") // normalize dots and underscores → spaces
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
    return norm(name1) === norm(name2);
  }

  // ─── scanSeriesDirectory() ────────────────────────────────────────────────

  /**
   * Scans a TV root directory and returns an array of series objects.
   * @param {string} tvPath  Root folder containing show folders.
   * @returns {Promise<Array>}
   */
  async scanSeriesDirectory(tvPath) {
    const entries = await fs.readdir(tvPath, { withFileTypes: true });
    const result = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const seriesPath = path.join(tvPath, entry.name);

      let isCurated = false;
      try {
        await fs.access(path.join(seriesPath, ".curated"));
        isCurated = true;
      } catch {
        // not curated
      }

      const seasons = await this._scanSeasons(seriesPath);
      result.push({ name: entry.name, path: seriesPath, isCurated, seasons });
    }

    return result;
  }

  async _scanSeasons(seriesPath) {
    const entries = await fs.readdir(seriesPath, { withFileTypes: true });
    const seasons = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const seasonPath = path.join(seriesPath, entry.name);
      const { number, isSpecials } = this._parseSeasonDirName(entry.name);
      if (number < 0) continue; // unrecognized folder

      const episodes = await this._scanEpisodes(seasonPath);
      seasons.push({ number, path: seasonPath, isSpecials, episodes });
    }

    return seasons.sort((a, b) => a.number - b.number);
  }

  _parseSeasonDirName(name) {
    const match = name.match(/^Season\s+(\d+)$/i);
    if (match) {
      const number = parseInt(match[1], 10);
      return { number, isSpecials: number === 0 };
    }
    if (/^specials$/i.test(name)) {
      return { number: 0, isSpecials: true };
    }
    return { number: -1, isSpecials: false };
  }

  async _scanEpisodes(seasonPath) {
    const entries = await fs.readdir(seasonPath, { withFileTypes: true });
    const episodes = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!VIDEO_EXTS.has(ext)) continue;
      episodes.push({ name: entry.name, path: path.join(seasonPath, entry.name) });
    }

    return episodes;
  }

  // ─── renameEpisodeFile() ──────────────────────────────────────────────────

  /**
   * Renames a single episode file to its Plex-formatted name.
   * Returns the new path (unchanged if already correctly named).
   */
  async renameEpisodeFile(srcPath, parsedInfo) {
    const newName = this.toPlexEpisodeFilename(parsedInfo);
    const dir = path.dirname(srcPath);
    const newPath = path.join(dir, newName);

    if (path.basename(srcPath) === newName) return newPath;

    await fs.rename(srcPath, newPath);
    return newPath;
  }

  // ─── renameSeasonEpisodes() ───────────────────────────────────────────────

  /**
   * Renames all video episodes in a season directory to Plex format.
   * Non-video files are counted in `skipped`.
   * @returns {{renamed: number, skipped: number}}
   */
  async renameSeasonEpisodes(seasonDir, showName, year, { dryRun = false } = {}) {
    const entries = await fs.readdir(seasonDir, { withFileTypes: true });
    let renamed = 0;
    let skipped = 0;

    for (const entry of entries) {
      if (!entry.isFile()) continue;

      const ext = path.extname(entry.name).toLowerCase();
      if (!VIDEO_EXTS.has(ext)) {
        skipped++;
        continue;
      }

      const parsed = this.parseEpisodeFilename(entry.name);
      // Unparseable video files: silently skip (don't count in skipped)
      if (!parsed) continue;

      const info = { ...parsed, showName, year };
      const newName = this.toPlexEpisodeFilename(info);

      if (entry.name === newName) continue; // already correct

      if (!dryRun) {
        await fs.rename(path.join(seasonDir, entry.name), path.join(seasonDir, newName));
        renamed++;
      }
      // dry-run: would rename, but renamed stays 0
    }

    return { renamed, skipped };
  }

  // ─── updateEpisodeTags() ──────────────────────────────────────────────────

  /**
   * Writes embedded metadata tags to a video file using ffmpeg (no re-encode).
   * Supports: title, show, season_number, episode_sort, date.
   */
  async updateEpisodeTags(filePath, { show, season, episode, title, year } = {}, { dryRun = false } = {}) {
    if (dryRun) {
      return { filePath, dryRun: true };
    }

    const ext = path.extname(filePath);
    // Usa /tmp para evitar erros de permissão em pastas owned by root
    const tmpPath = path.join(os.tmpdir(), `curator_videotmp_${Date.now()}_${process.pid}${ext}`);

    const metaArgs = [];

    if (show != null) metaArgs.push("-metadata", `show=${show}`);
    if (season != null) metaArgs.push("-metadata", `season_number=${season}`);
    if (episode != null) metaArgs.push("-metadata", `episode_sort=${episode}`);
    if (title != null) metaArgs.push("-metadata", `title=${title}`);
    if (year != null) metaArgs.push("-metadata", `date=${year}`);

    if (metaArgs.length === 0) return { filePath, unchanged: true };

    await execFileAsync("ffmpeg", ["-y", "-i", filePath, "-c", "copy", ...metaArgs, tmpPath]);
    await fs.copyFile(tmpPath, filePath);
    await fs.unlink(tmpPath);
    return { filePath, updated: true };
  }

  // ─── findDuplicateSeries() ────────────────────────────────────────────────

  /**
   * Scans tvPath and returns groups of series folders that are equivalent
   * (same title, different names/years/tags).
   * Each group has ≥2 entries.
   */
  async findDuplicateSeries(tvPath) {
    const series = await this.scanSeriesDirectory(tvPath);
    const groups = [];
    const matched = new Set();

    for (let i = 0; i < series.length; i++) {
      if (matched.has(i)) continue;
      const group = [series[i]];

      for (let j = i + 1; j < series.length; j++) {
        if (matched.has(j)) continue;
        if (this.areSeriesEquivalent(series[i].name, series[j].name)) {
          group.push(series[j]);
          matched.add(j);
        }
      }

      if (group.length > 1) {
        matched.add(i);
        groups.push(group);
      }
    }

    return groups;
  }

  // ─── consolidateSeriesDirectory() ────────────────────────────────────────

  /**
   * Main orchestrator: renames all series folders to Plex canonical names
   * (querying AllFather for metadata), merges duplicates, and marks curated.
   *
   * @param {string} tvPath
   * @param {{dryRun?:boolean, skipCurated?:boolean}} opts
   * @returns {Promise<{consolidated: number}>}
   */
  async consolidateSeriesDirectory(tvPath, { dryRun = false, skipCurated = false } = {}) {
    const series = await this.scanSeriesDirectory(tvPath);
    let consolidated = 0;

    for (const show of series) {
      if (skipCurated && show.isCurated) continue;

      // Resolve canonical name via AllFather if available
      let metaTitle = null;
      let metaYear = null;

      if (this.allFather) {
        try {
          const rawName = show.name
            .replace(/\s*\[[^\]]*\]/g, "")
            .replace(/\s*\(\d{4}\)/g, "")
            .trim();
          const meta = await this.allFather.getSeriesMetadata(rawName);
          if (meta && meta.title) {
            metaTitle = meta.title;
            metaYear = meta.year || null;
          }
        } catch {
          // AllFather unavailable — fall back to folder name
        }
      }

      const rawTitle =
        metaTitle ||
        show.name
          .replace(/\s*\[[^\]]*\]/g, "")
          .replace(/\s*\(\d{4}\)/g, "")
          .trim();
      const year = metaYear || this.extractYearFromName(show.name);
      const canonicalName = this.toPlexSeriesName(rawTitle, year);
      const canonicalPath = path.join(tvPath, canonicalName);

      if (!dryRun) {
        if (show.path !== canonicalPath) {
          // Check if canonical path already exists — if so, merge rather than rename
          let targetExists = false;
          try {
            await fs.access(canonicalPath);
            targetExists = true;
          } catch {
            /* doesn't exist, safe to rename */
          }

          if (targetExists) {
            // Merge: move each season dir into the canonical path
            const seasonDirs = await fs.readdir(show.path, { withFileTypes: true });
            for (const entry of seasonDirs) {
              if (!entry.isDirectory()) continue;
              const srcSeason = path.join(show.path, entry.name);
              const dstSeason = path.join(canonicalPath, entry.name);
              try {
                await fs.access(dstSeason);
                // Destination season exists — move individual files
                const files = await fs.readdir(srcSeason);
                for (const f of files) {
                  await fs.rename(path.join(srcSeason, f), path.join(dstSeason, f));
                }
              } catch {
                // Destination season doesn't exist — move entire dir
                await fs.rename(srcSeason, dstSeason);
              }
            }
            await fs.rm(show.path, { recursive: true, force: true });
          } else {
            await fs.rename(show.path, canonicalPath);
          }
          consolidated++;
        }
        // Mark as curated
        const curatedMarker = path.join(canonicalPath, ".curated");
        await fs.writeFile(curatedMarker, JSON.stringify({ curatedAt: new Date().toISOString() }));
      }
    }

    // Merge any remaining duplicate folders (re-scan after renames)
    if (!dryRun) {
      const groups = await this.findDuplicateSeries(tvPath);
      for (const group of groups) {
        // Prefer folder that already has the year, or the first one
        const canonical = group.find((s) => this.extractYearFromName(s.name)) || group[0];
        const others = group.filter((s) => s !== canonical);

        for (const other of others) {
          for (const season of other.seasons) {
            const destSeason = path.join(canonical.path, path.basename(season.path));
            await fs.mkdir(destSeason, { recursive: true });
            for (const ep of season.episodes) {
              await fs.rename(ep.path, path.join(destSeason, ep.name));
            }
          }
          await fs.rm(other.path, { recursive: true, force: true });
          consolidated++;
        }
      }
    }

    return { consolidated };
  }
}
