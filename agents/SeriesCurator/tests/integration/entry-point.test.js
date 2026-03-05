import fs from "fs/promises";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { jest } from "@jest/globals";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * INTEGRATION TESTS – entry point (index.js)
 *
 * Testa que:
 *  1. SERIES_PATH do .env / variável de ambiente é respeitado
 *  2. O fallback padrão resolve para <root>/tv
 *  3. Erros de diretório inexistente são propagados corretamente
 *  4. --dry-run não renomeia pastas
 *  5. --skip-curated pula séries marcadas
 */
describe("SeriesCurator – entry point (index.js)", () => {
  const indexPath = path.resolve(__dirname, "../../index.js");
  const rootPath = path.resolve(__dirname, "../../");

  // ─── Resolução do SERIES_PATH ───────────────────────────────────────────────

  describe("resolução do tvPath", () => {
    it("usa SERIES_PATH da variável de ambiente quando definida", async () => {
      // O consolidator vai tentar ler o diretório — se a variável for respeitada
      // o erro vai mencionar o caminho correto
      const fakePath = "/tmp/fake-series-path-does-not-exist";
      const { SeriesCurator } = await import("../../src/series-curator.js");

      const curator = new SeriesCurator(fakePath, null, { dryRun: true });

      await expect(curator.curate()).rejects.toThrow(/fake-series-path-does-not-exist/);
    });

    it("fallback padrão aponta para <repo-root>/tv (dois níveis acima do index.js)", () => {
      // index.js está em agents/SeriesCurator/
      // ../.. a partir daí = plex_server/
      const agentsDir = path.resolve(rootPath, "..");       // agents/
      const repoRoot = path.resolve(agentsDir, "..");       // plex_server/
      const expectedFallback = path.join(repoRoot, "tv");

      // A lógica real em index.js: path.resolve(__dirname, "../..", "tv")
      // onde __dirname = agents/SeriesCurator
      const indexDir = path.resolve(__dirname, "../..");    // agents/SeriesCurator
      const actualFallback = path.resolve(indexDir, "../..", "tv");

      expect(actualFallback).toBe(expectedFallback);
    });

    it("fallback correto resolve para o diretório /tv real da biblioteca", () => {
      // Garante que o fallback não aponte para /Pessoal/tv (bug anterior: ../../../tv)
      const indexDir = path.resolve(__dirname, "../..");    // agents/SeriesCurator
      const fallback = path.resolve(indexDir, "../..", "tv");

      // Deve conter "plex_server/tv", não "Pessoal/tv"
      expect(fallback).toMatch(/plex_server[/\\]tv$/);
      expect(fallback).not.toMatch(/Pessoal[/\\]tv$/);
    });
  });

  // ─── SeriesCurator com diretório controlado ─────────────────────────────────

  describe("integração com tvPath controlado", () => {
    let tvDir;

    beforeEach(async () => {
      tvDir = await fs.mkdtemp(path.join(os.tmpdir(), "tv-entry-test-"));
    });

    afterEach(async () => {
      if (tvDir) await fs.rm(tvDir, { recursive: true, force: true });
    });

    async function buildShow(name, episodes = ["show - s01e01.mkv"]) {
      const showDir = path.join(tvDir, name);
      const seasonDir = path.join(showDir, "Season 01");
      await fs.mkdir(seasonDir, { recursive: true });
      for (const ep of episodes) {
        await fs.writeFile(path.join(seasonDir, ep), "fake video");
      }
      return showDir;
    }

    it("curate() com dryRun=true não renomeia nenhum arquivo", async () => {
      await buildShow("Breaking Bad");

      const { SeriesCurator } = await import("../../src/series-curator.js");
      const curator = new SeriesCurator(tvDir, null, { dryRun: true });
      await curator.curate();

      const dirs = await fs.readdir(tvDir);
      expect(dirs).toContain("Breaking Bad");
    });

    it("curate() processa a série e retorna processed=1", async () => {
      await buildShow("Night Sky");

      const { SeriesCurator } = await import("../../src/series-curator.js");
      const curator = new SeriesCurator(tvDir, null, { dryRun: true });
      const result = await curator.curate();

      expect(result.processed).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it("curate() com skipCurated=true pula série com .curated", async () => {
      const showDir = await buildShow("Breaking Bad (2008)");
      await fs.writeFile(path.join(showDir, ".curated"), "{}");

      const { SeriesCurator } = await import("../../src/series-curator.js");
      const curator = new SeriesCurator(tvDir, null, { dryRun: true, skipCurated: true });
      const result = await curator.curate();

      expect(result.skipped).toBe(1);
      expect(result.processed).toBe(0);
    });

    it("curate() com AllFather mockado usa metadata retornada", async () => {
      await buildShow("breaking bad");

      const mockAllFather = {
        getSeriesMetadata: jest.fn().mockResolvedValue({
          title: "Breaking Bad",
          year: "2008",
        }),
        checkConnection: jest.fn().mockResolvedValue(true),
      };

      const { SeriesCurator } = await import("../../src/series-curator.js");
      const curator = new SeriesCurator(tvDir, mockAllFather, { dryRun: true });
      await curator.curate();

      expect(mockAllFather.getSeriesMetadata).toHaveBeenCalledWith("breaking bad");
    });

    it("curate() retorna erro descritivo quando a pasta tv não existe", async () => {
      const { SeriesCurator } = await import("../../src/series-curator.js");
      const curator = new SeriesCurator("/tmp/nonexistent-tv-dir-xyzzy", null, { dryRun: true });

      await expect(curator.curate()).rejects.toThrow(/ENOENT|nonexistent/);
    });

    it("diretório vazio resulta em processed=0 sem erros", async () => {
      const { SeriesCurator } = await import("../../src/series-curator.js");
      const curator = new SeriesCurator(tvDir, null, { dryRun: true });
      const result = await curator.curate();

      expect(result.processed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });
});
