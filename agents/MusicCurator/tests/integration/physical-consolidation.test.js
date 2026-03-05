import fs from "fs/promises";
import path from "path";
import os from "os";
import { AlbumConsolidator } from "../../src/album-consolidator.js";

/**
 * Testes de integração para consolidação física de álbuns
 * Baseados em examples/test-physical-consolidation.js
 *
 * AllFather é mockado para não precisar de Ollama rodando.
 */
describe("AlbumConsolidator – consolidação física de álbuns", () => {
  let testDir;
  let artistDir;

  function createMockAllFather({ similarity = 0.95, albumName = "The Singularity", year = "2022" } = {}) {
    return {
      getMusicMetadata: jest.fn().mockResolvedValue({ album: albumName, year }),
      compareImagesByContent: jest.fn().mockResolvedValue(similarity),
    };
  }

  async function buildTestArtistDir() {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "music-test-consolidation-"));
    artistDir = path.join(testDir, "Wo Fat");
    await fs.mkdir(artistDir);

    // Álbum 1 – com cover
    const album1 = path.join(artistDir, "The Singularity (2022)");
    await fs.mkdir(album1);
    await fs.writeFile(path.join(album1, "01 - Track One.flac"), "fake audio");
    await fs.writeFile(path.join(album1, "02 - Track Two.flac"), "fake audio");
    await fs.writeFile(path.join(album1, "cover.jpg"), "fake image");

    // Álbum 2 – cópia do mesmo cover (álbum duplicado)
    const album2 = path.join(artistDir, "The Singularity Duplicate (2022)");
    await fs.mkdir(album2);
    await fs.writeFile(path.join(album2, "03 - Track Three.flac"), "fake audio");
    await fs.writeFile(path.join(album2, "cover.jpg"), "fake image");

    return { album1, album2 };
  }

  afterEach(async () => {
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true });
      testDir = null;
    }
  });

  it("detecta grupos de álbuns similares em dry-run", async () => {
    const { album1 } = await buildTestArtistDir();
    const allfather = createMockAllFather();
    const consolidator = new AlbumConsolidator(allfather);

    const result = await consolidator.consolidateArtistAlbums(artistDir, "Wo Fat", {
      dryRun: true,
      skipCurated: false,
      similarityThreshold: 0.5,
      normalizeToTitleCase: true,
    });

    // Em dry-run, nenhum arquivo deve ser movido
    const album1Files = await fs.readdir(album1);
    expect(album1Files).toContain("01 - Track One.flac");
    expect(album1Files).toContain("02 - Track Two.flac");
  });

  it("consolida fisicamente as faixas de álbuns similares (real run)", async () => {
    await buildTestArtistDir();
    const allfather = createMockAllFather({ similarity: 0.95, albumName: "The Singularity", year: "2022" });
    const consolidator = new AlbumConsolidator(allfather);

    const result = await consolidator.consolidateArtistAlbums(artistDir, "Wo Fat", {
      dryRun: false,
      skipCurated: false,
      similarityThreshold: 0.5,
      normalizeToTitleCase: true,
    });

    // Deve ter resultado de consolidação
    expect(result).toBeDefined();

    // Verifica que pelo menos um diretório com [CURATED] foi criado
    const finalDirs = await fs.readdir(artistDir);
    const curatedDir = finalDirs.find((d) => d.includes("[CURATED]"));
    expect(curatedDir).toBeDefined();
  });

  it("não consolida álbuns com similaridade abaixo do threshold", async () => {
    await buildTestArtistDir();
    // Similaridade baixa – não deve consolidar
    const allfather = createMockAllFather({ similarity: 0.1 });
    const consolidator = new AlbumConsolidator(allfather);

    const result = await consolidator.consolidateArtistAlbums(artistDir, "Wo Fat", {
      dryRun: false,
      skipCurated: false,
      similarityThreshold: 0.85, // Threshold alto
      normalizeToTitleCase: true,
    });

    // Como similaridade é baixa, grupos de consolidação devem ser vazios
    const consolidationCount = result.consolidationResults?.length || 0;
    expect(consolidationCount).toBe(0);
  });

  it("pula artista com todos os álbuns já curados quando skipCurated=true", async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "music-test-skipall-"));
    artistDir = path.join(testDir, "Curated Artist");
    await fs.mkdir(artistDir);

    // Apenas álbum já curado
    const curatedAlbum = path.join(artistDir, "My Album [CURATED]");
    await fs.mkdir(curatedAlbum);
    await fs.writeFile(path.join(curatedAlbum, "01 - Song.flac"), "fake");
    await fs.writeFile(path.join(curatedAlbum, "cover.jpg"), "fake");

    const allfather = createMockAllFather();
    const consolidator = new AlbumConsolidator(allfather);

    const result = await consolidator.consolidateArtistAlbums(artistDir, "Curated Artist", {
      dryRun: false,
      skipCurated: true,
      similarityThreshold: 0.5,
      normalizeToTitleCase: true,
    });

    // compareImagesByContent não deve ser chamado pois não há álbuns para comparar
    expect(allfather.compareImagesByContent).not.toHaveBeenCalled();
  });
});
