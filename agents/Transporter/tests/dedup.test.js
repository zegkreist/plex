import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
import { findExistingAlbumDir } from "../src/dedup.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

let tmp;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "transporter-dedup-")); });
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

// ─── findExistingAlbumDir ─────────────────────────────────────────────────────

describe("findExistingAlbumDir", () => {
  test("encontra pasta com nome exato no filesystem", () => {
    const artistDir = path.join(tmp, "Radiohead");
    const albumDir = path.join(artistDir, "OK Computer");
    fs.mkdirSync(albumDir, { recursive: true });

    expect(findExistingAlbumDir("Radiohead", "OK Computer", artistDir, new Map())).toBe(albumDir);
  });

  test("encontra pasta remastered quando procuramos pelo nome limpo (fuzzy ≥ 0.85)", () => {
    const artistDir = path.join(tmp, "Radiohead");
    const albumDir = path.join(artistDir, "OK Computer Remastered");
    fs.mkdirSync(albumDir, { recursive: true });

    // "OK Computer" e "OK Computer Remastered" normalizam para "okcomputer"
    expect(findExistingAlbumDir("Radiohead", "OK Computer", artistDir, new Map())).toBe(albumDir);
  });

  test("encontra álbum no processedAlbums da sessão (antes de existir no disco)", () => {
    const albumPath = path.join(tmp, "Radiohead", "OK Computer");
    const processedAlbums = new Map([
      ["Radiohead/OK Computer", { artist: "Radiohead", albumName: "OK Computer", path: albumPath }],
    ]);

    const artistDir = path.join(tmp, "Radiohead");
    expect(findExistingAlbumDir("Radiohead", "OK Computer", artistDir, processedAlbums)).toBe(albumPath);
  });

  test("retorna null quando não há pasta compatível", () => {
    const artistDir = path.join(tmp, "Radiohead");
    fs.mkdirSync(artistDir, { recursive: true });

    expect(findExistingAlbumDir("Radiohead", "The Bends", artistDir, new Map())).toBeNull();
  });

  test("não confunde artistas diferentes — busca apenas em artistDir", () => {
    // Radiohead tem OK Computer, mas buscamos em Portishead (artistDir diferente)
    const rhDir = path.join(tmp, "Radiohead");
    fs.mkdirSync(path.join(rhDir, "OK Computer"), { recursive: true });

    const phDir = path.join(tmp, "Portishead"); // não existe
    expect(findExistingAlbumDir("Portishead", "OK Computer", phDir, new Map())).toBeNull();
  });

  test("retorna null se artistDir não existe", () => {
    const artistDir = path.join(tmp, "Artista Inexistente");
    expect(findExistingAlbumDir("Artista Inexistente", "Álbum", artistDir, new Map())).toBeNull();
  });

  test("processedAlbums tem prioridade sobre filesystem", () => {
    // No disco existe "OK Computer Remastered"
    const artistDir = path.join(tmp, "Radiohead");
    const diskAlbum = path.join(artistDir, "OK Computer Remastered");
    fs.mkdirSync(diskAlbum, { recursive: true });

    // Na sessão existe o caminho limpo
    const sessionAlbum = path.join(artistDir, "OK Computer");
    const processedAlbums = new Map([
      ["Radiohead/OK Computer", { artist: "Radiohead", albumName: "OK Computer", path: sessionAlbum }],
    ]);

    // Deve retornar o da sessão (encontrado primeiro)
    expect(findExistingAlbumDir("Radiohead", "OK Computer", artistDir, processedAlbums)).toBe(sessionAlbum);
  });
});
