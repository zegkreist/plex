import fs from "fs/promises";
import path from "path";
import os from "os";
import { MovieConsolidator } from "../../src/movie-consolidator.js";

/**
 * INTEGRATION TESTS – consolidateMoviesDirectory()
 */
describe("MovieConsolidator – consolidateMoviesDirectory()", () => {
  let mc;
  let tmpDir;

  beforeEach(async () => {
    mc = new MovieConsolidator(null);
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mc-consolidate-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  // ─── DRY RUN: não move arquivos ────────────────────────────────────────────

  describe("modo dry-run", () => {
    it("não move arquivos quando dryRun=true", async () => {
      await fs.writeFile(path.join(tmpDir, "Avatar.2009.1080p.mkv"), "data");

      const result = await mc.consolidateMoviesDirectory(tmpDir, { dryRun: true });

      expect(result.renamed).toBe(1);
      // Original file must still exist
      const originalExists = await fs
        .access(path.join(tmpDir, "Avatar.2009.1080p.mkv"))
        .then(() => true)
        .catch(() => false);
      expect(originalExists).toBe(true);
    });

    it("não cria marcador .curated quando dryRun=true", async () => {
      const folderPath = path.join(tmpDir, "Avatar (2009)");
      await fs.mkdir(folderPath);
      await fs.writeFile(path.join(folderPath, "Avatar (2009).mkv"), "data");

      await mc.consolidateMoviesDirectory(tmpDir, { dryRun: true });

      const curatedExists = await fs
        .access(path.join(folderPath, ".curated"))
        .then(() => true)
        .catch(() => false);
      expect(curatedExists).toBe(false);
    });
  });

  // ─── Loose files → pasta Plex ─────────────────────────────────────────────

  describe("loose files — criação de pasta Plex", () => {
    it("move arquivo solto para pasta Plex correta", async () => {
      await fs.writeFile(
        path.join(tmpDir, "The.Dark.Knight.2008.1080p.BluRay.mkv"),
        "data"
      );

      await mc.consolidateMoviesDirectory(tmpDir, { dryRun: false });

      const destFile = path.join(
        tmpDir,
        "The Dark Knight (2008)",
        "The Dark Knight (2008).mkv"
      );
      const exists = await fs
        .access(destFile)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it("cria o marcador .curated após mover", async () => {
      await fs.writeFile(path.join(tmpDir, "Avatar.2009.mkv"), "data");

      await mc.consolidateMoviesDirectory(tmpDir, { dryRun: false });

      const curatedPath = path.join(tmpDir, "Avatar (2009)", ".curated");
      const exists = await fs
        .access(curatedPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it("remove o arquivo solto original após mover", async () => {
      const original = path.join(tmpDir, "Avatar.2009.mkv");
      await fs.writeFile(original, "data");

      await mc.consolidateMoviesDirectory(tmpDir, { dryRun: false });

      const originalExists = await fs
        .access(original)
        .then(() => true)
        .catch(() => false);
      expect(originalExists).toBe(false);
    });
  });

  // ─── Pastas existentes → renomear para Plex ───────────────────────────────

  describe("pastas existentes — renomear para formato Plex", () => {
    it("renomeia pasta e arquivo para formato Plex correto", async () => {
      const folderPath = path.join(tmpDir, "avatar.2009.1080p");
      await fs.mkdir(folderPath);
      await fs.writeFile(path.join(folderPath, "avatar.2009.1080p.mkv"), "data");

      await mc.consolidateMoviesDirectory(tmpDir, { dryRun: false });

      const destFile = path.join(tmpDir, "Avatar (2009)", "Avatar (2009).mkv");
      const exists = await fs
        .access(destFile)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });

  // ─── skipCurated ─────────────────────────────────────────────────────────

  describe("opção skipCurated", () => {
    it("pula pastas com .curated quando skipCurated=true", async () => {
      const folderPath = path.join(tmpDir, "Avatar (2009)");
      await fs.mkdir(folderPath);
      await fs.writeFile(path.join(folderPath, "Avatar (2009).mkv"), "data");
      await fs.writeFile(
        path.join(folderPath, ".curated"),
        JSON.stringify({ curatedAt: "2024-01-01" })
      );

      const result = await mc.consolidateMoviesDirectory(tmpDir, {
        dryRun: false,
        skipCurated: true,
      });

      expect(result.skipped).toBe(1);
      expect(result.renamed).toBe(0);
    });

    it("não pula pastas .curated quando skipCurated=false (default)", async () => {
      const folderPath = path.join(tmpDir, "Avatar (2009)");
      await fs.mkdir(folderPath);
      await fs.writeFile(path.join(folderPath, "Avatar (2009).mkv"), "data");
      await fs.writeFile(
        path.join(folderPath, ".curated"),
        JSON.stringify({ curatedAt: "2024-01-01" })
      );

      const result = await mc.consolidateMoviesDirectory(tmpDir, {
        dryRun: false,
        skipCurated: false,
      });

      expect(result.renamed).toBe(1);
      expect(result.skipped).toBe(0);
    });
  });

  // ─── Retorno de estatísticas ──────────────────────────────────────────────

  describe("retorno de estatísticas", () => {
    it("retorna renamed=0 e errors=[] para pasta vazia", async () => {
      const result = await mc.consolidateMoviesDirectory(tmpDir);
      expect(result).toEqual({ renamed: 0, skipped: 0, errors: [] });
    });

    it("conta filmes renomeados corretamente", async () => {
      for (const name of [
        "Avatar.2009.mkv",
        "The.Dark.Knight.2008.mkv",
      ]) {
        await fs.writeFile(path.join(tmpDir, name), "data");
      }

      const result = await mc.consolidateMoviesDirectory(tmpDir, { dryRun: false });
      expect(result.renamed).toBe(2);
      expect(result.errors).toHaveLength(0);
    });
  });
});
