import { describe, expect, test } from "@jest/globals";
import { sanitizeName, cleanAlbumName, normalizeForComparison, calculateSimilarity } from "../src/strings.js";

// ─── sanitizeName ─────────────────────────────────────────────────────────────

describe("sanitizeName", () => {
  test("remove caracteres inválidos em nomes de pasta", () => {
    expect(sanitizeName('AC/DC: Back in Black? <ok>')).toBe("ACDC Back in Black ok");
  });

  test("normaliza espaços múltiplos", () => {
    expect(sanitizeName("Pink   Floyd")).toBe("Pink Floyd");
  });

  test("faz trim", () => {
    expect(sanitizeName("  Nirvana  ")).toBe("Nirvana");
  });

  test("nome limpo permanece intacto", () => {
    expect(sanitizeName("The Beatles")).toBe("The Beatles");
  });
});

// ─── cleanAlbumName ───────────────────────────────────────────────────────────

describe("cleanAlbumName", () => {
  test("remove [FLAC]", () => {
    expect(cleanAlbumName("OK Computer [FLAC]")).toBe("OK Computer");
  });

  test("remove (Year) seguido de [FLAC]", () => {
    expect(cleanAlbumName("OK Computer (1997) [FLAC]")).toBe("OK Computer");
  });

  test("remove [24bit Hi-Res Web]", () => {
    expect(cleanAlbumName("Dark Side of the Moon [24bit Hi-Res Web]")).toBe("Dark Side of the Moon");
  });

  test("remove Remastered no final", () => {
    expect(cleanAlbumName("Demolition Remastered")).toBe("Demolition");
  });

  test("remove (Deluxe Edition) no final", () => {
    expect(cleanAlbumName("In Utero (Deluxe Edition)")).toBe("In Utero");
  });

  test("remove Anniversary Edition no final", () => {
    expect(cleanAlbumName("Abbey Road Anniversary Edition")).toBe("Abbey Road");
  });

  test("preserva nome simples sem tags", () => {
    expect(cleanAlbumName("The Wall")).toBe("The Wall");
  });
});

// ─── normalizeForComparison ───────────────────────────────────────────────────

describe("normalizeForComparison", () => {
  test("remove (Remastered)", () => {
    expect(normalizeForComparison("OK Computer (Remastered)")).toBe("okcomputer");
  });

  test("remove ano solto", () => {
    expect(normalizeForComparison("OK Computer 1997")).toBe("okcomputer");
  });

  test("remove (Deluxe Edition)", () => {
    expect(normalizeForComparison("In Utero (Deluxe Edition)")).toBe("inutero");
  });

  test("remove (live)", () => {
    expect(normalizeForComparison("Nevermind (live)")).toBe("nevermind");
  });

  test("remove acentos", () => {
    expect(normalizeForComparison("Música")).toBe("musica");
  });

  test("variantes do mesmo álbum normalizam igual", () => {
    const variants = [
      "OK Computer",
      "OK Computer (Remastered)",
      "OK Computer 1997",
      "OK Computer (Deluxe Edition)",
    ];
    const normalized = variants.map((v) => normalizeForComparison(v));
    expect(new Set(normalized).size).toBe(1);
  });
});

// ─── calculateSimilarity ─────────────────────────────────────────────────────

describe("calculateSimilarity", () => {
  test("strings idênticas retornam 1.0", () => {
    expect(calculateSimilarity("okcomputer", "okcomputer")).toBe(1.0);
  });

  test("strings completamente diferentes retornam valor baixo", () => {
    expect(calculateSimilarity("abc", "xyz")).toBeLessThan(0.5);
  });

  test("strings quase iguais retornam valor ≥ 0.85", () => {
    expect(calculateSimilarity("okcomputer", "okcomputer2")).toBeGreaterThan(0.85);
  });

  test("strings vazias retornam 1.0", () => {
    expect(calculateSimilarity("", "")).toBe(1.0);
  });
});
