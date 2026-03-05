import { AlbumConsolidator } from "../../src/album-consolidator.js";

/**
 * Testes unitários para normalização de nomes de álbuns
 * Baseados em examples/test-normalization.js
 */
describe("AlbumConsolidator – normalização de nomes", () => {
  let consolidator;

  beforeEach(() => {
    consolidator = new AlbumConsolidator(null);
  });

  // ─── toTitleCase ────────────────────────────────────────────────────────────

  describe("toTitleCase()", () => {
    it("converte string em minúsculas para Title Case", () => {
      expect(consolidator.toTitleCase("the dark side of the moon")).toBe("The Dark Side Of The Moon");
    });

    it("converte string em MAIÚSCULAS para Title Case", () => {
      expect(consolidator.toTitleCase("OK COMPUTER")).toBe("Ok Computer");
    });

    it("converte string já em Title Case sem alterar essencial", () => {
      expect(consolidator.toTitleCase("The Wall")).toBe("The Wall");
    });

    it("lida com string vazia", () => {
      expect(consolidator.toTitleCase("")).toBe("");
    });

    it("trata múltiplos espaços corretamente", () => {
      expect(consolidator.toTitleCase("wish you were here")).toBe("Wish You Were Here");
    });
  });

  // ─── normalizeAlbumName ──────────────────────────────────────────────────────

  describe("normalizeAlbumName()", () => {
    it("remove '(remastered YYYY)' entre parênteses", () => {
      const result = consolidator.normalizeAlbumName("the dark side of the moon (remastered 2011)");
      expect(result).not.toMatch(/remastered/i);
      expect(result).toBe("The Dark Side Of The Moon");
    });

    it("remove palavra 'remastered' solta no nome", () => {
      const result = consolidator.normalizeAlbumName("led zeppelin iv remastered");
      expect(result).not.toMatch(/remastered/i);
    });

    it("preserva tags técnicas em colchetes", () => {
      const result = consolidator.normalizeAlbumName("Dark Side Of Moon [MP4] [16B-44100kHz]");
      expect(result).toContain("[MP4]");
      expect(result).toContain("[16B-44100kHz]");
    });

    it("aplica Title Case ao texto principal, preservando tags em colchetes", () => {
      const result = consolidator.normalizeAlbumName("Orphans Of The Singe (2022) [MP4] [16B-44100kHz]");
      expect(result).toContain("Orphans Of The Singe");
      expect(result).toContain("(2022)");
      expect(result).toContain("[MP4]");
    });

    it("mantém o ano entre parênteses quando não é 'remastered'", () => {
      const result = consolidator.normalizeAlbumName("The Singularity (2022) [MP4] [16B-44100kHz]");
      expect(result).toContain("(2022)");
    });

    it("remove remastered mas mantém o ano separado", () => {
      const result = consolidator.normalizeAlbumName("Noche del Chupacabra (remastered 2025) (2011) [MP4] [16B-44100kHz]");
      expect(result).not.toMatch(/remastered/i);
      expect(result).toContain("(2011)");
    });

    it("normaliza espaçamento múltiplo", () => {
      const result = consolidator.normalizeAlbumName("Random Access Memories [FLAC 24bit/96kHz]");
      expect(result).not.toMatch(/\s{2,}/);
    });

    it("converte nome todo em minúsculas para Title Case", () => {
      const result = consolidator.normalizeAlbumName("wish you were here");
      expect(result).toBe("Wish You Were Here");
    });

    it("normaliza álbum com FLAC tag", () => {
      const result = consolidator.normalizeAlbumName("moving pictures [CD FLAC]");
      expect(result).toContain("[CD FLAC]");
    });
  });

  // ─── areNamesEquivalent ──────────────────────────────────────────────────────

  describe("areNamesEquivalent()", () => {
    it("considera nomes identicos como equivalentes", () => {
      expect(consolidator.areNamesEquivalent("The Wall", "The Wall")).toBe(true);
    });

    it("considera nomes equivalentes ignorando case", () => {
      expect(consolidator.areNamesEquivalent("the wall", "THE WALL")).toBe(true);
    });

    it("considera nomes com e sem remastered como equivalentes", () => {
      expect(consolidator.areNamesEquivalent("The Dark Side of the Moon (remastered 2011)", "The Dark Side of the Moon")).toBe(true);
    });

    it("considera nomes diferentes como não equivalentes", () => {
      expect(consolidator.areNamesEquivalent("The Wall", "Animals")).toBe(false);
    });

    it("considera nomes com mesmas tags técnicas como equivalentes", () => {
      expect(consolidator.areNamesEquivalent("Dark Side Of The Moon [FLAC]", "dark side of the moon [FLAC]")).toBe(true);
    });

    it("considera nomes com tags técnicas diferentes como não equivalentes", () => {
      expect(consolidator.areNamesEquivalent("Dark Side Of The Moon [MP4]", "Dark Side Of The Moon [FLAC]")).toBe(false);
    });
  });
});
