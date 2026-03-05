import fs from "fs/promises";
import path from "path";
import os from "os";
import { SeriesConsolidator } from "../../src/series-consolidator.js";

/**
 * INTEGRATION TESTS – scanSeriesDirectory() e scanSeasonDirectory()
 */
describe("SeriesConsolidator – scan de diretório de séries", () => {
  let sc;
  let tvDir;

  beforeEach(async () => {
    sc = new SeriesConsolidator(null);
    tvDir = await fs.mkdtemp(path.join(os.tmpdir(), "tv-test-scan-"));
  });

  afterEach(async () => {
    await fs.rm(tvDir, { recursive: true, force: true });
  });

  // helper: cria estrutura mínima de série
  async function buildSeries(name, seasons) {
    const seriesDir = path.join(tvDir, name);
    await fs.mkdir(seriesDir);
    for (const [seasonNum, episodes] of Object.entries(seasons)) {
      const seasonDir = path.join(seriesDir, `Season ${String(seasonNum).padStart(2, "0")}`);
      await fs.mkdir(seasonDir);
      for (const ep of episodes) {
        await fs.writeFile(path.join(seasonDir, ep), "fake video");
      }
    }
    return seriesDir;
  }

  it("detecta todas as séries dentro do diretório TV", async () => {
    await buildSeries("Breaking Bad (2008)", { 1: ["Breaking Bad (2008) - s01e01 - Pilot.mkv"] });
    await buildSeries("Better Call Saul (2015)", { 1: ["Better Call Saul (2015) - s01e01.mkv"] });

    const series = await sc.scanSeriesDirectory(tvDir);

    expect(series).toHaveLength(2);
    expect(series.map((s) => s.name)).toContain("Breaking Bad (2008)");
    expect(series.map((s) => s.name)).toContain("Better Call Saul (2015)");
  });

  it("detecta as temporadas de cada série", async () => {
    await buildSeries("Breaking Bad (2008)", {
      1: ["Breaking Bad (2008) - s01e01.mkv"],
      2: ["Breaking Bad (2008) - s02e01.mkv"],
    });

    const series = await sc.scanSeriesDirectory(tvDir);
    const show = series.find((s) => s.name === "Breaking Bad (2008)");

    expect(show.seasons).toHaveLength(2);
  });

  it("detecta episódios dentro de cada temporada", async () => {
    await buildSeries("Night Sky", {
      1: ["Night Sky - s01e01.mkv", "Night Sky - s01e02.mkv", "Night Sky - s01e03.mkv"],
    });

    const series = await sc.scanSeriesDirectory(tvDir);
    const show = series.find((s) => s.name === "Night Sky");
    const season1 = show.seasons.find((s) => s.number === 1);

    expect(season1.episodes).toHaveLength(3);
  });

  it("inclui path correto de cada episódio", async () => {
    await buildSeries("Night Sky", {
      1: ["Night Sky - s01e01.mkv"],
    });

    const series = await sc.scanSeriesDirectory(tvDir);
    const ep = series[0].seasons[0].episodes[0];

    expect(ep.path).toContain("Night Sky - s01e01.mkv");
    await expect(fs.access(ep.path)).resolves.toBeUndefined();
  });

  it("marca série como curada quando tem .curated na pasta raiz", async () => {
    const seriesDir = await buildSeries("Night Sky [CURATED]", {
      1: ["Night Sky - s01e01.mkv"],
    });
    await fs.writeFile(path.join(seriesDir, ".curated"), "{}");

    const series = await sc.scanSeriesDirectory(tvDir);
    const show = series.find((s) => s.name === "Night Sky [CURATED]");

    expect(show.isCurated).toBe(true);
  });

  it("marca série sem .curated como não curada", async () => {
    await buildSeries("Night Sky", { 1: ["Night Sky - s01e01.mkv"] });

    const series = await sc.scanSeriesDirectory(tvDir);
    expect(series[0].isCurated).toBe(false);
  });

  it("ignora arquivos que não são vídeo na contagem de episódios", async () => {
    await buildSeries("Night Sky", {
      1: ["Night Sky - s01e01.mkv", "cover.jpg", "thumbs.db"],
    });

    const series = await sc.scanSeriesDirectory(tvDir);
    const season1 = series[0].seasons[0];

    expect(season1.episodes).toHaveLength(1);
  });

  it("retorna número da temporada corretamente (Season 02 → 2)", async () => {
    await buildSeries("Better Call Saul (2015)", {
      2: ["Better Call Saul (2015) - s02e01.mkv"],
    });

    const series = await sc.scanSeriesDirectory(tvDir);
    expect(series[0].seasons[0].number).toBe(2);
  });

  it("detecta Season 00 como Specials", async () => {
    await buildSeries("Grey's Anatomy (2005)", {
      0: ["Grey's Anatomy (2005) - s00e01 - Straight to the Heart.mkv"],
    });

    const series = await sc.scanSeriesDirectory(tvDir);
    const season0 = series[0].seasons.find((s) => s.number === 0);

    expect(season0).toBeDefined();
    expect(season0.isSpecials).toBe(true);
  });
});
