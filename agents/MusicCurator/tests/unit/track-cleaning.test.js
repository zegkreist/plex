import { AlbumConsolidator } from "../../src/album-consolidator.js";

/**
 * Testes unitários para limpeza de nomes de faixas
 * Baseados em examples/test-track-cleaning.js
 */
describe("AlbumConsolidator – limpeza de nomes de faixas", () => {
  let consolidator;

  beforeEach(() => {
    consolidator = new AlbumConsolidator(null);
  });

  describe("extractCleanTrackName()", () => {
    it("remove numeração '01 - ' do início", () => {
      expect(consolidator.extractCleanTrackName("01 - The Witching Chamber.flac")).toBe("The Witching Chamber");
    });

    it("remove numeração '02 - ' do início", () => {
      expect(consolidator.extractCleanTrackName("02 - Orphans Of The Singe.flac")).toBe("Orphans Of The Singe");
    });

    it("remove numeração '1.' com ponto do início", () => {
      expect(consolidator.extractCleanTrackName("1. Into The Deep.flac")).toBe("Into The Deep");
    });

    it("remove numeração '03.' com ponto do início", () => {
      expect(consolidator.extractCleanTrackName("03. Heavy Vibe.flac")).toBe("Heavy Vibe");
    });

    it("remove prefixo 'Track 04 - '", () => {
      expect(consolidator.extractCleanTrackName("Track 04 - Mountain Crusher.flac")).toBe("Mountain Crusher");
    });

    it("remove numeração '05 ' sem hífen", () => {
      expect(consolidator.extractCleanTrackName("05 The Unraveling.flac")).toBe("The Unraveling");
    });

    it("remove numeração '6 - ' de dígito único", () => {
      expect(consolidator.extractCleanTrackName("6 - Solar Winds.flac")).toBe("Solar Winds");
    });

    it("remove numeração com zeros à esquerda '007 - '", () => {
      expect(consolidator.extractCleanTrackName("007 - Secret Track.flac")).toBe("Secret Track");
    });

    it("remove numeração '10.' de dois dígitos com ponto", () => {
      expect(consolidator.extractCleanTrackName("10. Final Song.flac")).toBe("Final Song");
    });

    it("remove extensão do arquivo", () => {
      const result = consolidator.extractCleanTrackName("01 - Song Name.flac");
      expect(result).not.toContain(".flac");
    });

    it("não altera o nome limpo quando não há numeração", () => {
      // Mesmo sem numeração, a extensão deve ser removida
      const result = consolidator.extractCleanTrackName("Heavy Metal Song.flac");
      expect(result).toBe("Heavy Metal Song");
    });

    it("lida com número antes do nome sem separador", () => {
      const result = consolidator.extractCleanTrackName("99 Heavy Metal Song.flac");
      expect(result).toBe("Heavy Metal Song");
    });
  });
});
