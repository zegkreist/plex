import fs from "fs/promises";
import path from "path";
import os from "os";
import { MovieCurator } from "../../src/movie-curator.js";

/**
 * INTEGRATION TESTS – MovieCurator.curate()
 */
describe("MovieCurator – curate()", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mc-curator-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("retorna processed=0 para pasta vazia", async () => {
    const curator = new MovieCurator(tmpDir, null);
    const result = await curator.curate();
    expect(result).toEqual({ processed: 0, skipped: 0, errors: [] });
  });

  it("processa e renomeia um filme solto (loose file)", async () => {
    await fs.writeFile(path.join(tmpDir, "Inception.2010.1080p.mkv"), "data");

    const curator = new MovieCurator(tmpDir, null);
    const result = await curator.curate();

    expect(result.processed).toBe(1);
    expect(result.errors).toHaveLength(0);

    const destFile = path.join(tmpDir, "Inception (2010)", "Inception (2010).mkv");
    const exists = await fs
      .access(destFile)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });

  it("dry-run não move arquivos mas conta como processado", async () => {
    await fs.writeFile(path.join(tmpDir, "Inception.2010.mkv"), "data");

    const curator = new MovieCurator(tmpDir, null, { dryRun: true });
    const result = await curator.curate();

    expect(result.processed).toBe(1);

    // Original must still be there
    const exists = await fs
      .access(path.join(tmpDir, "Inception.2010.mkv"))
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });

  it("pula filmes já curados quando skipCurated=true", async () => {
    const folderPath = path.join(tmpDir, "Avatar (2009)");
    await fs.mkdir(folderPath);
    await fs.writeFile(path.join(folderPath, "Avatar (2009).mkv"), "data");
    await fs.writeFile(path.join(folderPath, ".curated"), "{}");

    const curator = new MovieCurator(tmpDir, null, { skipCurated: true });
    const result = await curator.curate();

    expect(result.skipped).toBe(1);
    expect(result.processed).toBe(0);
  });

  it("usa metadata do AllFather quando disponível", async () => {
    await fs.writeFile(path.join(tmpDir, "avatar.2009.mkv"), "data");

    // Mock AllFather
    const mockAllFather = {
      getMovieMetadata: async (title) => ({
        title: "Avatar",
        year: "2009",
        imdbId: "tt0499549",
      }),
      checkConnection: async () => true,
    };

    const curator = new MovieCurator(tmpDir, mockAllFather);
    const result = await curator.curate();

    expect(result.processed).toBe(1);
    expect(result.errors).toHaveLength(0);

    const destFile = path.join(
      tmpDir,
      "Avatar (2009)",
      "Avatar (2009) {imdb-tt0499549}.mkv"
    );
    const exists = await fs
      .access(destFile)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });

  it("continua quando AllFather está indisponível (fallback)", async () => {
    await fs.writeFile(path.join(tmpDir, "The.Dark.Knight.2008.mkv"), "data");

    const mockAllFather = {
      getMovieMetadata: async () => {
        throw new Error("AllFather unavailable");
      },
      checkConnection: async () => false,
    };

    const curator = new MovieCurator(tmpDir, mockAllFather);
    const result = await curator.curate();

    // Should still process using filename-derived info
    expect(result.processed).toBe(1);
    expect(result.errors).toHaveLength(0);
  });
});
