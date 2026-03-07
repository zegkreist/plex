import fs from "fs/promises";
import path from "path";
import os from "os";
import { AlbumConsolidator } from "../../src/album-consolidator.js";

/**
 * Testes de integração para scanArtistDirectory
 * Baseados em examples/test-curated-detection.js
 */
describe("AlbumConsolidator – scanArtistDirectory()", () => {
  let consolidator;
  let testDir;

  beforeEach(async () => {
    consolidator = new AlbumConsolidator(null);
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "music-test-scan-"));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("detecta álbum SEM tag [CURATED] como não curado", async () => {
    const albumDir = path.join(testDir, "The Singularity (2022)");
    await fs.mkdir(albumDir, { recursive: true });

    const albums = await consolidator.scanArtistDirectory(testDir, "Wo Fat");

    const album = albums.find((a) => a.name === "The Singularity (2022)");
    expect(album).toBeDefined();
    expect(album.isCurated).toBe(false);
  });

  it("detecta álbum COM tag [CURATED] no nome como curado", async () => {
    const albumDir = path.join(testDir, "Orphans Of The Singe (2022) [CURATED]");
    await fs.mkdir(albumDir, { recursive: true });

    const albums = await consolidator.scanArtistDirectory(testDir, "Wo Fat");

    const album = albums.find((a) => a.name === "Orphans Of The Singe (2022) [CURATED]");
    expect(album).toBeDefined();
    expect(album.isCurated).toBe(true);
  });

  it("detecta álbum com arquivo .curated como curado", async () => {
    const albumDir = path.join(testDir, "Some Album");
    await fs.mkdir(albumDir, { recursive: true });
    await fs.writeFile(path.join(albumDir, ".curated"), JSON.stringify({ curatedAt: new Date().toISOString() }));

    const albums = await consolidator.scanArtistDirectory(testDir, "Artist");

    const album = albums.find((a) => a.name === "Some Album");
    expect(album).toBeDefined();
    expect(album.isCurated).toBe(true);
  });

  it("retorna contagem correta de faixas por álbum", async () => {
    const albumDir = path.join(testDir, "My Album");
    await fs.mkdir(albumDir, { recursive: true });
    await fs.writeFile(path.join(albumDir, "01 - Track One.flac"), "fake");
    await fs.writeFile(path.join(albumDir, "02 - Track Two.flac"), "fake");

    const albums = await consolidator.scanArtistDirectory(testDir, "Artist");

    const album = albums.find((a) => a.name === "My Album");
    expect(album).toBeDefined();
    expect(album.trackCount).toBe(2);
  });

  it("processa múltiplos álbuns com estados diferentes", async () => {
    const uncurated = path.join(testDir, "The Singularity (2022)");
    const curated = path.join(testDir, "Orphans Of The Singe (2022) [CURATED]");

    await fs.mkdir(uncurated, { recursive: true });
    await fs.mkdir(curated, { recursive: true });

    const albums = await consolidator.scanArtistDirectory(testDir, "Wo Fat");

    expect(albums).toHaveLength(2);
    const notCurated = albums.find((a) => !a.isCurated);
    const isCurated = albums.find((a) => a.isCurated);

    expect(notCurated).toBeDefined();
    expect(isCurated).toBeDefined();
  });

  it("inclui nome do artista e caminho correto para cada álbum", async () => {
    const albumDir = path.join(testDir, "Test Album");
    await fs.mkdir(albumDir, { recursive: true });

    const albums = await consolidator.scanArtistDirectory(testDir, "Test Artist");

    expect(albums[0].artist).toBe("Test Artist");
    expect(albums[0].path).toBe(albumDir);
  });
});
