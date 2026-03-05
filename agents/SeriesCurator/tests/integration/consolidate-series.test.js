import fs from "fs/promises";
import path from "path";
import os from "os";
import { jest } from "@jest/globals";
import { SeriesConsolidator } from "../../src/series-consolidator.js";

/**
 * INTEGRATION TESTS – consolidateSeriesDirectory()
 * AllFather é mockado — não precisa de Ollama rodando.
 */
describe("SeriesConsolidator – consolidação de séries duplicadas", () => {
  let tvDir;

  function createMockAllFather(metadata = {}) {
    return {
      getSeriesMetadata: jest.fn().mockResolvedValue({
        title: metadata.title || "Breaking Bad",
        year: metadata.year || "2008",
        seasons: metadata.seasons || "5",
        genre: "Crime, Drama",
        creator: "Vince Gilligan",
        rating: "9.5",
        plot: "A chemistry teacher turned drug manufacturer.",
        cast: ["Bryan Cranston"],
      }),
      checkConnection: jest.fn().mockResolvedValue(true),
    };
  }

  async function buildTvDir(structure) {
    tvDir = await fs.mkdtemp(path.join(os.tmpdir(), "tv-test-consolidate-"));
    for (const [showFolder, seasons] of Object.entries(structure)) {
      const showDir = path.join(tvDir, showFolder);
      await fs.mkdir(showDir, { recursive: true });
      for (const [seasonName, episodes] of Object.entries(seasons)) {
        const seasonDir = path.join(showDir, seasonName);
        await fs.mkdir(seasonDir, { recursive: true });
        for (const ep of episodes) {
          await fs.writeFile(path.join(seasonDir, ep), "fake video");
        }
      }
    }
    return tvDir;
  }

  afterEach(async () => {
    if (tvDir) await fs.rm(tvDir, { recursive: true, force: true });
    tvDir = null;
  });

  it("detecta duas pastas com o mesmo título como duplicatas", async () => {
    await buildTvDir({
      "Breaking Bad": { "Season 01": ["Breaking Bad - s01e01.mkv"] },
      "Breaking Bad (2008)": { "Season 01": ["Breaking Bad (2008) - s01e01.mkv"] },
    });

    const sc = new SeriesConsolidator(createMockAllFather());
    const groups = await sc.findDuplicateSeries(tvDir);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
  });

  it("não considera séries distintas como duplicatas", async () => {
    await buildTvDir({
      "Breaking Bad (2008)": { "Season 01": ["Breaking Bad (2008) - s01e01.mkv"] },
      "Better Call Saul (2015)": { "Season 01": ["Better Call Saul (2015) - s01e01.mkv"] },
    });

    const sc = new SeriesConsolidator(createMockAllFather());
    const groups = await sc.findDuplicateSeries(tvDir);

    expect(groups).toHaveLength(0);
  });

  it("consolida série duplicada em pasta canônica (dry-run não altera arquivos)", async () => {
    const originalFile = "Breaking Bad - s01e01.mkv";
    await buildTvDir({
      "Breaking Bad": { "Season 01": [originalFile] },
      "Breaking Bad (2008)": { "Season 01": ["Breaking Bad (2008) - s01e01.mkv"] },
    });

    const sc = new SeriesConsolidator(createMockAllFather());
    const result = await sc.consolidateSeriesDirectory(tvDir, { dryRun: true });

    // Em dry-run os arquivos originais devem existir
    await expect(fs.access(path.join(tvDir, "Breaking Bad", "Season 01", originalFile))).resolves.toBeUndefined();
    expect(result.consolidated).toBeGreaterThanOrEqual(0);
  });

  it("consolida série criando pasta com nome canônico Plex", async () => {
    await buildTvDir({
      "Breaking Bad": { "Season 01": ["Breaking Bad - s01e01.mkv"] },
      "Breaking Bad (2008)": { "Season 01": ["Breaking Bad (2008) - s01e01.mkv"] },
    });

    const sc = new SeriesConsolidator(createMockAllFather({ title: "Breaking Bad", year: "2008" }));
    const result = await sc.consolidateSeriesDirectory(tvDir, { dryRun: false });

    const dirs = await fs.readdir(tvDir);
    const canonicalDir = dirs.find((d) => d.includes("Breaking Bad"));
    expect(canonicalDir).toContain("Breaking Bad");
    expect(result.consolidated).toBeGreaterThan(0);
  });

  it("pula série já curada quando skipCurated=true", async () => {
    await buildTvDir({
      "Breaking Bad (2008) [CURATED]": { "Season 01": ["Breaking Bad (2008) - s01e01.mkv"] },
    });
    const seriesDir = path.join(tvDir, "Breaking Bad (2008) [CURATED]");
    await fs.writeFile(path.join(seriesDir, ".curated"), "{}");

    const allfather = createMockAllFather();
    const sc = new SeriesConsolidator(allfather);
    await sc.consolidateSeriesDirectory(tvDir, { dryRun: false, skipCurated: true });

    // getSeriesMetadata não deve ser chamado para já curados
    expect(allfather.getSeriesMetadata).not.toHaveBeenCalled();
  });

  it("marca série consolidada com .curated no final", async () => {
    await buildTvDir({
      "Night Sky": { "Season 01": ["Night Sky - s01e01.mkv"] },
    });

    const sc = new SeriesConsolidator(createMockAllFather({ title: "Night Sky", year: "2022" }));
    await sc.consolidateSeriesDirectory(tvDir, { dryRun: false, skipCurated: false });

    const dirs = await fs.readdir(tvDir);
    const curatedDir = dirs.find((d) => d.includes("[CURATED]") || d === "Night Sky (2022)");
    expect(curatedDir).toBeDefined();

    const curatedFile = path.join(tvDir, curatedDir, ".curated");
    await expect(fs.access(curatedFile)).resolves.toBeUndefined();
  });
});

// ─── Agrupamento de séries com nomes variados ────────────────────────────────

describe("SeriesConsolidator – agrupamento por nomes variados", () => {
  let tvDir;

  async function buildTvDir(structure) {
    tvDir = await fs.mkdtemp(path.join(os.tmpdir(), "tv-test-names-"));
    for (const [showFolder, seasons] of Object.entries(structure)) {
      const showDir = path.join(tvDir, showFolder);
      await fs.mkdir(showDir, { recursive: true });
      for (const [seasonName, episodes] of Object.entries(seasons)) {
        const seasonDir = path.join(showDir, seasonName);
        await fs.mkdir(seasonDir, { recursive: true });
        for (const ep of episodes) {
          await fs.writeFile(path.join(seasonDir, ep), "fake video");
        }
      }
    }
    return tvDir;
  }

  afterEach(async () => {
    if (tvDir) await fs.rm(tvDir, { recursive: true, force: true });
    tvDir = null;
  });

  // ─── Equivalência de nomes ───────────────────────────────────────────────

  it("agrupa pastas com notação de pontos e nome normal como duplicatas", async () => {
    await buildTvDir({
      "Game.of.Thrones": { "Season 01": ["GoT.S01E01.mkv"] },
      "Game of Thrones (2011)": { "Season 01": ["Game of Thrones (2011) - s01e01.mkv"] },
    });

    const sc = new SeriesConsolidator(null);
    const groups = await sc.findDuplicateSeries(tvDir);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
  });

  it("agrupa três variantes do mesmo nome numa única entrada", async () => {
    await buildTvDir({
      "Breaking Bad": { "Season 01": ["Breaking Bad - s01e01.mkv"] },
      "Breaking Bad (2008)": { "Season 01": ["Breaking Bad (2008) - s01e02.mkv"] },
      "Breaking.Bad": { "Season 01": ["Breaking.Bad.S01E03.mkv"] },
    });

    const sc = new SeriesConsolidator(null);
    const groups = await sc.findDuplicateSeries(tvDir);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(3);
  });

  it("não agrupa séries distintas mesmo com nomes parecidos", async () => {
    await buildTvDir({
      "The Office (US)": { "Season 01": ["The Office (US) - s01e01.mkv"] },
      "The Office (UK)": { "Season 01": ["The Office (UK) - s01e01.mkv"] },
    });

    const sc = new SeriesConsolidator(null);
    const groups = await sc.findDuplicateSeries(tvDir);

    expect(groups).toHaveLength(0);
  });

  // ─── Episódios espalhados em múltiplas pastas de série ───────────────────

  it("consolida episódios da mesma temporada espalhados em duas pastas de série", async () => {
    await buildTvDir({
      "Night Sky": {
        "Season 01": ["Night Sky - s01e01.mkv", "Night Sky - s01e02.mkv", "Night Sky - s01e03.mkv"],
      },
      "Night Sky (2022)": {
        "Season 01": ["Night Sky (2022) - s01e04.mkv", "Night Sky (2022) - s01e05.mkv"],
      },
    });

    const sc = new SeriesConsolidator(jest.fn().mockReturnValue({ getSeriesMetadata: jest.fn().mockResolvedValue({ title: "Night Sky", year: "2022" }) })());

    // Usa findDuplicateSeries para verificar o agrupamento antes de consolidar
    const groups = await sc.findDuplicateSeries(tvDir);
    expect(groups).toHaveLength(1);
    // Grupo deve conter as duas pastas
    const allEps = groups[0].flatMap((s) => s.seasons.flatMap((se) => se.episodes));
    expect(allEps).toHaveLength(5);
  });

  it("após consolidação a Season 01 contém os episódios de ambas as pastas originais", async () => {
    await buildTvDir({
      "Night Sky": {
        "Season 01": ["Night Sky - s01e01.mkv", "Night Sky - s01e02.mkv"],
      },
      "Night Sky (2022)": {
        "Season 01": ["Night Sky (2022) - s01e03.mkv", "Night Sky (2022) - s01e04.mkv"],
      },
    });

    const sc = new SeriesConsolidator(null);
    // sem AllFather: consolidação usa nome derivado da pasta
    await sc.consolidateSeriesDirectory(tvDir, { dryRun: false });

    const dirs = await fs.readdir(tvDir);
    // Deve existir apenas UMA pasta de série após consolidação
    expect(dirs.filter((d) => !d.startsWith("."))).toHaveLength(1);

    const canonicalDir = dirs[0];
    const season1 = path.join(tvDir, canonicalDir, "Season 01");
    const finalEps = await fs.readdir(season1);
    // Todos os 4 episódios devem estar juntos
    expect(finalEps.filter((f) => f.endsWith(".mkv"))).toHaveLength(4);
  });

  it("consolida episódios de temporadas diferentes espalhados em duas pastas", async () => {
    await buildTvDir({
      "Breaking Bad": {
        "Season 01": ["Breaking Bad - s01e01.mkv", "Breaking Bad - s01e02.mkv"],
        "Season 02": ["Breaking Bad - s02e01.mkv"],
      },
      "Breaking Bad (2008)": {
        "Season 02": ["Breaking Bad (2008) - s02e02.mkv", "Breaking Bad (2008) - s02e03.mkv"],
        "Season 03": ["Breaking Bad (2008) - s03e01.mkv"],
      },
    });

    const sc = new SeriesConsolidator(null);
    await sc.consolidateSeriesDirectory(tvDir, { dryRun: false });

    const dirs = await fs.readdir(tvDir);
    expect(dirs.filter((d) => !d.startsWith("."))).toHaveLength(1);

    const canonicalDir = dirs[0];

    // Season 01 deve ter 2 episódios
    const s1Eps = await fs.readdir(path.join(tvDir, canonicalDir, "Season 01"));
    expect(s1Eps.filter((f) => f.endsWith(".mkv"))).toHaveLength(2);

    // Season 02 deve ter 3 episódios (1 + 2)
    const s2Eps = await fs.readdir(path.join(tvDir, canonicalDir, "Season 02"));
    expect(s2Eps.filter((f) => f.endsWith(".mkv"))).toHaveLength(3);

    // Season 03 deve ter 1 episódio
    const s3Eps = await fs.readdir(path.join(tvDir, canonicalDir, "Season 03"));
    expect(s3Eps.filter((f) => f.endsWith(".mkv"))).toHaveLength(1);
  });
});
