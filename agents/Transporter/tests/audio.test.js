import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
import {
  AUDIO_EXTENSIONS,
  isAudioFile,
  isDiscFolder,
  hasDirectAudio,
  isReleaseFolder,
  findAudioFiles,
  parseAlbumFolderName,
} from "../src/audio.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

let tmp;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "transporter-audio-")); });
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

function touch(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, "");
}

// ─── AUDIO_EXTENSIONS ────────────────────────────────────────────────────────

describe("AUDIO_EXTENSIONS", () => {
  test("contém os formatos essenciais", () => {
    expect(AUDIO_EXTENSIONS).toEqual(expect.arrayContaining([".flac", ".mp3", ".m4a", ".ogg", ".opus", ".wav"]));
  });

  test("todas as entradas começam com ponto", () => {
    expect(AUDIO_EXTENSIONS.every((e) => e.startsWith("."))).toBe(true);
  });

  test("todas as entradas são lowercase", () => {
    expect(AUDIO_EXTENSIONS.every((e) => e === e.toLowerCase())).toBe(true);
  });
});

// ─── isAudioFile ─────────────────────────────────────────────────────────────

describe("isAudioFile", () => {
  test.each([".flac", ".mp3", ".m4a", ".ogg", ".opus", ".wav", ".flac"])(
    "reconhece %s como áudio",
    (ext) => expect(isAudioFile(`track${ext}`)).toBe(true)
  );

  test("rejeita .mkv", () => expect(isAudioFile("movie.mkv")).toBe(false));
  test("rejeita .jpg", () => expect(isAudioFile("cover.jpg")).toBe(false));
  test("é case-insensitive (.MP3)", () => expect(isAudioFile("track.MP3")).toBe(true));
  test("é case-insensitive (.FLAC)", () => expect(isAudioFile("track.FLAC")).toBe(true));
});

// ─── isDiscFolder ─────────────────────────────────────────────────────────────

describe("isDiscFolder", () => {
  test("detecta 'CD 1'", () => expect(isDiscFolder("CD 1")).toBe(true));
  test("detecta 'CD1' (sem espaço)", () => expect(isDiscFolder("CD1")).toBe(true));
  test("detecta 'Disc 2'", () => expect(isDiscFolder("Disc 2")).toBe(true));
  test("detecta 'Disk 1'", () => expect(isDiscFolder("Disk 1")).toBe(true));
  test("detecta case-insensitive 'disc 1'", () => expect(isDiscFolder("disc 1")).toBe(true));
  test("rejeita nome comum 'Album A'", () => expect(isDiscFolder("Album A")).toBe(false));
  test("rejeita 'Discography'", () => expect(isDiscFolder("Discography")).toBe(false));
});

// ─── hasDirectAudio ──────────────────────────────────────────────────────────

describe("hasDirectAudio", () => {
  test("retorna true quando há .flac na pasta", () => {
    touch(path.join(tmp, "01.flac"));
    expect(hasDirectAudio(tmp)).toBe(true);
  });

  test("retorna false quando só há subpastas", () => {
    fs.mkdirSync(path.join(tmp, "Subfolder"));
    expect(hasDirectAudio(tmp)).toBe(false);
  });

  test("retorna false quando pasta está vazia", () => {
    expect(hasDirectAudio(tmp)).toBe(false);
  });

  test("retorna false quando só há imagens", () => {
    touch(path.join(tmp, "cover.jpg"));
    expect(hasDirectAudio(tmp)).toBe(false);
  });
});

// ─── isReleaseFolder ─────────────────────────────────────────────────────────

describe("isReleaseFolder", () => {
  test("pasta com .flac direto → release", () => {
    touch(path.join(tmp, "01.flac"));
    expect(isReleaseFolder(tmp)).toBe(true);
  });

  test("pasta com CD 1/tracks → release", () => {
    touch(path.join(tmp, "CD 1", "01.flac"));
    expect(isReleaseFolder(tmp)).toBe(true);
  });

  test("pasta com apens subpastas de álbuns → artista (não release)", () => {
    touch(path.join(tmp, "Album A", "01.flac"));
    expect(isReleaseFolder(tmp)).toBe(false);
  });

  test("pasta vazia → não é release", () => {
    expect(isReleaseFolder(tmp)).toBe(false);
  });
});

// ─── findAudioFiles ──────────────────────────────────────────────────────────

describe("findAudioFiles", () => {
  test("encontra arquivos na raiz", () => {
    touch(path.join(tmp, "01.flac"));
    touch(path.join(tmp, "02.mp3"));
    const files = findAudioFiles(tmp);
    expect(files).toHaveLength(2);
  });

  test("encontra arquivos em subpastas recursivamente", () => {
    touch(path.join(tmp, "CD 1", "01.flac"));
    touch(path.join(tmp, "CD 2", "01.mp3"));
    const files = findAudioFiles(tmp);
    expect(files).toHaveLength(2);
  });

  test("ignora arquivos não-áudio", () => {
    touch(path.join(tmp, "01.flac"));
    touch(path.join(tmp, "cover.jpg"));
    touch(path.join(tmp, "info.txt"));
    const files = findAudioFiles(tmp);
    expect(files).toHaveLength(1);
  });

  test("retorna array vazio se não há áudio", () => {
    expect(findAudioFiles(tmp)).toEqual([]);
  });
});

// ─── parseAlbumFolderName ─────────────────────────────────────────────────────

describe("parseAlbumFolderName", () => {
  test("Artist - Year - Album", () => {
    const r = parseAlbumFolderName("Judas Priest - 2001 - Demolition");
    expect(r).toMatchObject({ artist: "Judas Priest", year: "2001", album: "Demolition" });
  });

  test("Artist - Album (Year) [FLAC]", () => {
    const r = parseAlbumFolderName("Radiohead - OK Computer (1997) [FLAC]");
    expect(r).toMatchObject({ artist: "Radiohead", year: "1997", album: "OK Computer" });
  });

  test("Artist - Album sem ano", () => {
    const r = parseAlbumFolderName("Pink Floyd - The Wall");
    expect(r).toMatchObject({ artist: "Pink Floyd", year: null, album: "The Wall" });
  });

  test("sem hífen — Unknown Artist", () => {
    const r = parseAlbumFolderName("SomeRandomAlbum");
    expect(r).toMatchObject({ artist: "Unknown Artist", album: "SomeRandomAlbum" });
  });

  test("Album (Year) sem artista", () => {
    const r = parseAlbumFolderName("Nevermind (1991)");
    expect(r).toMatchObject({ artist: "Unknown Artist", year: "1991", album: "Nevermind" });
  });
});
