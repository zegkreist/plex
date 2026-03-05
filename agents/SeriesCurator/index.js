/**
 * SeriesCurator – Entry Point
 *
 * Reads SERIES_PATH (or falls back to ../../tv) and runs the full curation
 * pipeline using AllFather for metadata resolution.
 *
 * Usage (standalone):
 *   node index.js [--dry-run] [--skip-curated] [--verbose]
 *
 * Usage (programmatic):
 *   import { SeriesCurator } from './agents/SeriesCurator/index.js';
 */

import path from "path";
import { fileURLToPath } from "url";

export { SeriesConsolidator } from "./src/series-consolidator.js";
export { SeriesCurator } from "./src/series-curator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ESM main-module guard
if (process.argv[1] === __filename) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const skipCurated = args.includes("--skip-curated");
  const verbose = args.includes("--verbose");

  const tvPath = process.env.SERIES_PATH || path.resolve(__dirname, "../../..", "tv");

  let allFather = null;
  try {
    // AllFather lives in the sibling AllFather agent
    const { AllFather } = await import("../AllFather/index.js");
    allFather = new AllFather();
    const ok = await allFather.checkConnection();
    if (!ok) {
      console.warn("[SeriesCurator] AllFather unavailable — running without metadata enrichment");
      allFather = null;
    }
  } catch {
    console.warn("[SeriesCurator] Could not load AllFather — running without metadata enrichment");
  }

  const { SeriesCurator } = await import("./src/series-curator.js");
  const curator = new SeriesCurator(tvPath, allFather, { dryRun, skipCurated, verbose });
  const result = await curator.curate();

  console.log(`\nResult: processed=${result.processed} skipped=${result.skipped} errors=${result.errors.length}`);
  if (result.errors.length > 0) {
    result.errors.forEach((e) => console.error(" -", e));
    process.exit(1);
  }
}
