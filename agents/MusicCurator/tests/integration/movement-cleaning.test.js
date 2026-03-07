import fs from "fs/promises";
import path from "path";
import os from "os";
import { AlbumConsolidator } from "../../src/album-consolidator.js";

/**
 * Testes de integração para moveAndRenameTrack
 * Baseados em examples/test-movement-cleaning.js
 */
describe("AlbumConsolidator – moveAndRenameTrack()", () => {
  let consolidator;
  let testDir;
  let sourceDir;
  let targetDir;

  beforeEach(async () => {
    consolidator = new AlbumConsolidator(null);
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "music-test-move-"));
    sourceDir = path.join(testDir, "source");
    targetDir = path.join(testDir, "target");
    await fs.mkdir(sourceDir, { recursive: true });
    await fs.mkdir(targetDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("move o arquivo da origem para o destino", async () => {
    const sourcePath = path.join(sourceDir, "01 - The Witching Chamber.flac");
    await fs.writeFile(sourcePath, "fake audio data");

    await consolidator.moveAndRenameTrack(sourcePath, targetDir, 1, "01 - The Witching Chamber.flac");

    // Arquivo não deve mais existir na origem
    await expect(fs.access(sourcePath)).rejects.toThrow();

    // Arquivo deve existir no destino
    const targetFiles = await fs.readdir(targetDir);
    expect(targetFiles).toHaveLength(1);
  });

  it("renomeia com nova numeração sequencial padded", async () => {
    const sourcePath = path.join(sourceDir, "99 - Some Song.flac");
    await fs.writeFile(sourcePath, "fake audio data");

    const newPath = await consolidator.moveAndRenameTrack(sourcePath, targetDir, 3, "99 - Some Song.flac");

    expect(path.basename(newPath)).toMatch(/^03 - /);
  });

  it("remove numeração original e aplica a nova", async () => {
    const sourcePath = path.join(sourceDir, "Track 04 - Mountain Crusher.flac");
    await fs.writeFile(sourcePath, "fake audio data");

    const newPath = await consolidator.moveAndRenameTrack(sourcePath, targetDir, 4, "Track 04 - Mountain Crusher.flac");

    const basename = path.basename(newPath);
    expect(basename).toBe("04 - Mountain Crusher.flac");
  });

  it("preserva a extensão do arquivo original", async () => {
    const sourcePath = path.join(sourceDir, "01 - Song.mp3");
    await fs.writeFile(sourcePath, "fake audio data");

    const newPath = await consolidator.moveAndRenameTrack(sourcePath, targetDir, 1, "01 - Song.mp3");

    expect(path.extname(newPath)).toBe(".mp3");
  });

  it("processa múltiplas faixas com numeração sequencial correta", async () => {
    const tracks = ["01 - The Witching Chamber.flac", "02 - Orphans Of The Singe.flac", "03. Override.flac"];

    for (const track of tracks) {
      await fs.writeFile(path.join(sourceDir, track), "fake audio data");
    }

    for (let i = 0; i < tracks.length; i++) {
      const src = path.join(sourceDir, tracks[i]);
      await consolidator.moveAndRenameTrack(src, targetDir, i + 1, tracks[i]);
    }

    const targetFiles = (await fs.readdir(targetDir)).sort();
    expect(targetFiles[0]).toMatch(/^01 - /);
    expect(targetFiles[1]).toMatch(/^02 - /);
    expect(targetFiles[2]).toMatch(/^03 - /);
  });

  it("lança erro quando o arquivo de origem não existe", async () => {
    await expect(consolidator.moveAndRenameTrack(path.join(sourceDir, "nonexistent.flac"), targetDir, 1, "nonexistent.flac")).rejects.toThrow();
  });
});
