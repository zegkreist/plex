/**
 * MovieCurator – Entry Point
 *
 * Reads MOVIES_PATH (or falls back to ../../movies) and runs the full curation
 * pipeline using AllFather for metadata resolution.
 *
 * Usage (standalone):
 *   node index.js [--dry-run] [--skip-curated] [--verbose]
 *
 * Usage (programmatic):
 *   import { MovieCurator } from './agents/MovieCurator/index.js';
 */

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// Load .env from the plex_server root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export { MovieConsolidator } from "./src/movie-consolidator.js";
export { MovieCurator } from "./src/movie-curator.js";

// ESM main-module guard
if (process.argv[1] === __filename) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const skipCurated = args.includes("--skip-curated");
  const verbose = args.includes("--verbose");

  const moviesPath =
    process.env.MOVIES_PATH || path.resolve(__dirname, "../..", "movies");

  let allFather = null;
  try {
    const { AllFather } = await import("../AllFather/index.js");
    allFather = new AllFather();
    const ok = await allFather.checkConnection();
    if (!ok) {
      console.warn(
        "[MovieCurator] AllFather unavailable — running without metadata enrichment"
      );
      allFather = null;
    }
  } catch {
    console.warn(
      "[MovieCurator] Could not load AllFather — running without metadata enrichment"
    );
  }

  const { MovieCurator } = await import("./src/movie-curator.js");
  const curator = new MovieCurator(moviesPath, allFather, {
    dryRun,
    skipCurated,
    verbose,
  });
  const result = await curator.curate();

  console.log(
    `\nResult: processed=${result.processed} skipped=${result.skipped} errors=${result.errors.length}`
  );
  if (result.errors.length > 0) {
    result.errors.forEach((e) => console.error(" -", e));
    process.exit(1);
  }
}
