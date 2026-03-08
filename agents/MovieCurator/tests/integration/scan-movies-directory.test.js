import fs from "fs/promises";
import path from "path";
import os from "os";
import { MovieConsolidator } from "../../src/movie-consolidator.js";

/**
 * INTEGRATION TESTS – scanMoviesDirectory()
 */
describe("MovieConsolidator – scanMoviesDirectory()", () => {
  let mc;
  let tmpDir;

  beforeEach(async () => {
    mc = new MovieConsolidator(null);
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mc-scan-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("retorna array vazio para pasta vazia", async () => {
    const result = await mc.scanMoviesDirectory(tmpDir);
    expect(result).toEqual([]);
  });

  it("detecta filme em pasta organizada no formato Plex", async () => {
    const folderPath = path.join(tmpDir, "Avatar (2009)");
    await fs.mkdir(folderPath);
    await fs.writeFile(path.join(folderPath, "Avatar (2009).mkv"), "");

    const result = await mc.scanMoviesDirectory(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Avatar (2009)");
    expect(result[0].isLoose).toBe(false);
    expect(result[0].isCurated).toBe(false);
  });

  it("detecta filme solto (loose file) na raiz", async () => {
    await fs.writeFile(path.join(tmpDir, "Avatar.2009.1080p.mkv"), "");

    const result = await mc.scanMoviesDirectory(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Avatar.2009.1080p.mkv");
    expect(result[0].isLoose).toBe(true);
    expect(result[0].isCurated).toBe(false);
  });

  it("detecta .curated marker na pasta", async () => {
    const folderPath = path.join(tmpDir, "Avatar (2009)");
    await fs.mkdir(folderPath);
    await fs.writeFile(path.join(folderPath, "Avatar (2009).mkv"), "");
    await fs.writeFile(path.join(folderPath, ".curated"), "{}");

    const result = await mc.scanMoviesDirectory(tmpDir);
    expect(result[0].isCurated).toBe(true);
  });

  it("ignora pastas sem arquivos de vídeo", async () => {
    const folderPath = path.join(tmpDir, "SomeFolder");
    await fs.mkdir(folderPath);
    await fs.writeFile(path.join(folderPath, "readme.txt"), "");

    const result = await mc.scanMoviesDirectory(tmpDir);
    expect(result).toHaveLength(0);
  });

  it("ignora arquivos não-vídeo na raiz", async () => {
    await fs.writeFile(path.join(tmpDir, "poster.jpg"), "");
    await fs.writeFile(path.join(tmpDir, "movie.nfo"), "");

    const result = await mc.scanMoviesDirectory(tmpDir);
    expect(result).toHaveLength(0);
  });

  it("detecta múltiplos filmes em pastas organizadas", async () => {
    for (const name of ["Avatar (2009)", "The Dark Knight (2008)"]) {
      const folderPath = path.join(tmpDir, name);
      await fs.mkdir(folderPath);
      await fs.writeFile(path.join(folderPath, `${name}.mkv`), "");
    }

    const result = await mc.scanMoviesDirectory(tmpDir);
    expect(result).toHaveLength(2);
    const names = result.map((r) => r.name).sort();
    expect(names).toEqual(["Avatar (2009)", "The Dark Knight (2008)"]);
  });

  it("detecta mix de filmes em pasta e loose files", async () => {
    // Organised
    const folderPath = path.join(tmpDir, "Avatar (2009)");
    await fs.mkdir(folderPath);
    await fs.writeFile(path.join(folderPath, "Avatar (2009).mkv"), "");
    // Loose
    await fs.writeFile(path.join(tmpDir, "The.Dark.Knight.2008.mkv"), "");

    const result = await mc.scanMoviesDirectory(tmpDir);
    expect(result).toHaveLength(2);
    const looseMovies = result.filter((r) => r.isLoose);
    const organizedMovies = result.filter((r) => !r.isLoose);
    expect(looseMovies).toHaveLength(1);
    expect(organizedMovies).toHaveLength(1);
  });
});
