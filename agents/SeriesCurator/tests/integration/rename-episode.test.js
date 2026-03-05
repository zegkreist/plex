import fs from "fs/promises";
import path from "path";
import os from "os";
import { SeriesConsolidator } from "../../src/series-consolidator.js";

/**
 * INTEGRATION TESTS – renameEpisodeFile() e renameSeasonEpisodes()
 */
describe("SeriesConsolidator – renomeação de episódios", () => {
  let sc;
  let testDir;

  beforeEach(async () => {
    sc = new SeriesConsolidator(null);
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "tv-test-rename-"));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  // ─── renameEpisodeFile() ─────────────────────────────────────────────────────

  describe("renameEpisodeFile()", () => {
    it("renomeia episódio para o formato Plex correto", async () => {
      const src = path.join(testDir, "Night.Sky.S01E01.mkv");
      await fs.writeFile(src, "fake video");

      const newPath = await sc.renameEpisodeFile(src, {
        showName: "Night Sky",
        year: "2022",
        season: 1,
        episode: 1,
        title: null,
        tags: [],
        ext: ".mkv",
      });

      expect(path.basename(newPath)).toBe("Night Sky (2022) - s01e01.mkv");
    });

    it("move o arquivo para o novo nome (origem deixa de existir)", async () => {
      const src = path.join(testDir, "old-name.mkv");
      await fs.writeFile(src, "fake video");

      await sc.renameEpisodeFile(src, {
        showName: "Show",
        year: null,
        season: 1,
        episode: 2,
        title: "Pilot",
        tags: [],
        ext: ".mkv",
      });

      await expect(fs.access(src)).rejects.toThrow();
    });

    it("inclui o título do episódio quando fornecido", async () => {
      const src = path.join(testDir, "band.s01e01.mkv");
      await fs.writeFile(src, "fake video");

      const newPath = await sc.renameEpisodeFile(src, {
        showName: "Band of Brothers",
        year: "2001",
        season: 1,
        episode: 1,
        title: "Currahee",
        tags: [],
        ext: ".mkv",
      });

      expect(path.basename(newPath)).toBe("Band Of Brothers (2001) - s01e01 - Currahee.mkv");
    });

    it("não move se o nome já está correto", async () => {
      const correctName = "Night Sky - s01e01.mkv";
      const src = path.join(testDir, correctName);
      await fs.writeFile(src, "fake video");

      const newPath = await sc.renameEpisodeFile(src, {
        showName: "Night Sky",
        year: null,
        season: 1,
        episode: 1,
        title: null,
        tags: [],
        ext: ".mkv",
      });

      expect(path.basename(newPath)).toBe(correctName);
      await expect(fs.access(newPath)).resolves.toBeUndefined();
    });
  });

  // ─── renameSeasonEpisodes() ──────────────────────────────────────────────────

  describe("renameSeasonEpisodes()", () => {
    it("renomeia todos os episódios de uma temporada", async () => {
      const seasonDir = path.join(testDir, "Season 01");
      await fs.mkdir(seasonDir);

      const files = ["Night.Sky.S01E01.mkv", "Night.Sky.S01E02.mkv", "Night.Sky.S01E03.mkv"];
      for (const f of files) {
        await fs.writeFile(path.join(seasonDir, f), "fake video");
      }

      const results = await sc.renameSeasonEpisodes(seasonDir, "Night Sky", "2022");

      expect(results.renamed).toBe(3);
      const finalFiles = await fs.readdir(seasonDir);
      // Todos devem seguir o padrão Plex
      finalFiles.forEach((f) => {
        expect(f).toMatch(/Night Sky \(2022\) - s01e0\d\.mkv/);
      });
    });

    it("retorna dry-run sem alterar arquivos", async () => {
      const seasonDir = path.join(testDir, "Season 01");
      await fs.mkdir(seasonDir);
      const originalName = "Night.Sky.S01E01.mkv";
      await fs.writeFile(path.join(seasonDir, originalName), "fake video");

      const results = await sc.renameSeasonEpisodes(seasonDir, "Night Sky", "2022", { dryRun: true });

      expect(results.renamed).toBe(0);
      // Arquivo original deve continuar existindo
      await expect(fs.access(path.join(seasonDir, originalName))).resolves.toBeUndefined();
    });

    it("ignora arquivos que não são vídeo", async () => {
      const seasonDir = path.join(testDir, "Season 01");
      await fs.mkdir(seasonDir);
      await fs.writeFile(path.join(seasonDir, "Night Sky - s01e01.mkv"), "fake video");
      await fs.writeFile(path.join(seasonDir, "cover.jpg"), "fake image");
      await fs.writeFile(path.join(seasonDir, "thumbs.db"), "fake db");

      const results = await sc.renameSeasonEpisodes(seasonDir, "Night Sky", null);

      expect(results.skipped).toBe(2); // cover.jpg e thumbs.db ignorados
    });
  });
});
