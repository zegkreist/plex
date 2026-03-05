import fs from "fs/promises";
import path from "path";
import os from "os";
import { AlbumConsolidator } from "../../src/album-consolidator.js";

/**
 * Testes de integração para removeOriginalAlbumFolder
 * Baseados em examples/test-original-folder-removal.js
 */
describe("AlbumConsolidator – removeOriginalAlbumFolder()", () => {
  let consolidator;
  let testDir;

  beforeEach(async () => {
    consolidator = new AlbumConsolidator(null);
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "music-test-removal-"));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("remove pasta completamente vazia", async () => {
    const emptyFolder = path.join(testDir, "Album Vazio");
    await fs.mkdir(emptyFolder);

    await consolidator.removeOriginalAlbumFolder(emptyFolder);

    await expect(fs.access(emptyFolder)).rejects.toThrow();
  });

  it("remove pasta que contém apenas arquivo de cover", async () => {
    const coverOnlyFolder = path.join(testDir, "Album com Cover");
    await fs.mkdir(coverOnlyFolder);
    await fs.writeFile(path.join(coverOnlyFolder, "cover.jpg"), "fake image");

    await consolidator.removeOriginalAlbumFolder(coverOnlyFolder);

    await expect(fs.access(coverOnlyFolder)).rejects.toThrow();
  });

  it("remove pasta que contém apenas cover e metadados (album.nfo)", async () => {
    const metaFolder = path.join(testDir, "Album com Metadata");
    await fs.mkdir(metaFolder);
    await fs.writeFile(path.join(metaFolder, "cover.jpg"), "fake image");
    await fs.writeFile(path.join(metaFolder, "album.nfo"), "metadata");

    await consolidator.removeOriginalAlbumFolder(metaFolder);

    await expect(fs.access(metaFolder)).rejects.toThrow();
  });

  it("NÃO remove pasta que ainda contém arquivo de música (.flac)", async () => {
    const musicFolder = path.join(testDir, "Album com Musica");
    await fs.mkdir(musicFolder);
    await fs.writeFile(path.join(musicFolder, "01 - Song.flac"), "fake audio");
    await fs.writeFile(path.join(musicFolder, "cover.jpg"), "fake image");

    await consolidator.removeOriginalAlbumFolder(musicFolder);

    // Pasta deve ainda existir
    await expect(fs.access(musicFolder)).resolves.toBeUndefined();
  });

  it("NÃO remove pasta que ainda contém arquivo de música (.mp3)", async () => {
    const musicFolder = path.join(testDir, "Album com MP3");
    await fs.mkdir(musicFolder);
    await fs.writeFile(path.join(musicFolder, "01 - Song.mp3"), "fake audio");

    await consolidator.removeOriginalAlbumFolder(musicFolder);

    await expect(fs.access(musicFolder)).resolves.toBeUndefined();
  });

  it("NÃO remove pasta que contém arquivo .m4a", async () => {
    const musicFolder = path.join(testDir, "Album M4A");
    await fs.mkdir(musicFolder);
    await fs.writeFile(path.join(musicFolder, "Track.m4a"), "fake audio");

    await consolidator.removeOriginalAlbumFolder(musicFolder);

    await expect(fs.access(musicFolder)).resolves.toBeUndefined();
  });

  it("ignora arquivos ocultos (ponto no início) ao verificar se está vazia", async () => {
    const hiddenOnlyFolder = path.join(testDir, "Album Apenas Ocultos");
    await fs.mkdir(hiddenOnlyFolder);
    await fs.writeFile(path.join(hiddenOnlyFolder, ".hidden"), "hidden");

    await consolidator.removeOriginalAlbumFolder(hiddenOnlyFolder);

    // Pasta deve ser removida pois só tem arquivos ocultos
    await expect(fs.access(hiddenOnlyFolder)).rejects.toThrow();
  });
});
