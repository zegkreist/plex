import { SeriesConsolidator } from "../../src/series-consolidator.js";

/**
 * UNIT TESTS – parseEpisodeFilename()
 *
 * Cobre os formatos descritos no naming guide do Plex:
 * https://support.plex.tv/articles/naming-and-organizing-your-tv-show-files/
 */
describe("SeriesConsolidator – parseEpisodeFilename()", () => {
  let sc;

  beforeEach(() => {
    sc = new SeriesConsolidator(null);
  });

  // ─── Formato padrão sXXeYY ──────────────────────────────────────────────────

  describe("formato sXXeYY padrão", () => {
    it("extrai season e episode de 's01e01'", () => {
      const r = sc.parseEpisodeFilename("Night Sky - s01e01.mkv");
      expect(r.season).toBe(1);
      expect(r.episode).toBe(1);
    });

    it("lida com números de 2 dígitos maiores", () => {
      const r = sc.parseEpisodeFilename("Grey's Anatomy (2005) - s02e17 - The First Cut.avi");
      expect(r.season).toBe(2);
      expect(r.episode).toBe(17);
    });

    it("lida com números de 1 dígito sem zero à esquerda", () => {
      const r = sc.parseEpisodeFilename("Show - s1e1 - Pilot.mkv");
      expect(r.season).toBe(1);
      expect(r.episode).toBe(1);
    });

    it("é case-insensitive (S01E01 maiúsculo)", () => {
      const r = sc.parseEpisodeFilename("Doctor Who (1963) - S01E01 - An Unearthly Child.mp4");
      expect(r.season).toBe(1);
      expect(r.episode).toBe(1);
    });

    it("extrai o título do episódio após o código de episódio", () => {
      const r = sc.parseEpisodeFilename("Band of Brothers (2001) - s01e01 - Currahee.mkv");
      expect(r.title).toBe("Currahee");
    });

    it("retorna título null quando episódio não tem título", () => {
      const r = sc.parseEpisodeFilename("Night Sky - s01e01.mkv");
      expect(r.title).toBeNull();
    });
  });

  // ─── Multi-episódio sXXeYY-eZZ ──────────────────────────────────────────────

  describe("multi-episódio sXXeYY-eZZ", () => {
    it("extrai episódio inicial e final", () => {
      const r = sc.parseEpisodeFilename("Grey's Anatomy (2005) - s02e01-e03.avi");
      expect(r.season).toBe(2);
      expect(r.episode).toBe(1);
      expect(r.episodeEnd).toBe(3);
    });

    it("retorna episodeEnd null para episódio único", () => {
      const r = sc.parseEpisodeFilename("Show - s01e01 - Title.mkv");
      expect(r.episodeEnd).toBeNull();
    });
  });

  // ─── Extração do nome da série ───────────────────────────────────────────────

  describe("extração do nome da série", () => {
    it("extrai showName antes do código de episódio", () => {
      const r = sc.parseEpisodeFilename("Night Sky - s01e01.mkv");
      expect(r.showName).toBe("Night Sky");
    });

    it("extrai showName com ano incluído", () => {
      const r = sc.parseEpisodeFilename("Band of Brothers (2001) - s01e01 - Currahee.mkv");
      expect(r.showName).toBe("Band of Brothers (2001)");
    });

    it("extrai showName de série com apóstrofo", () => {
      const r = sc.parseEpisodeFilename("Grey's Anatomy (2005) - s02e17 - The First Cut.avi");
      expect(r.showName).toBe("Grey's Anatomy (2005)");
    });
  });

  // ─── Extração de tags técnicas ───────────────────────────────────────────────

  describe("extração de tags técnicas", () => {
    it("extrai tags em colchetes no fim do nome", () => {
      const r = sc.parseEpisodeFilename("Band of Brothers (2001) - s01e01 - Currahee [1080p Bluray].mkv");
      expect(r.tags).toContain("1080p Bluray");
    });

    it("retorna tags como array vazio quando não há tags", () => {
      const r = sc.parseEpisodeFilename("Night Sky - s01e01.mkv");
      expect(r.tags).toEqual([]);
    });

    it("extrai múltiplas tags em colchetes separados", () => {
      const r = sc.parseEpisodeFilename("Show - s01e01 - Title [1080p] [BluRay].mkv");
      expect(r.tags).toHaveLength(2);
    });
  });

  // ─── Extensão do arquivo ─────────────────────────────────────────────────────

  describe("extensão do arquivo", () => {
    it("extrai extensão .mkv", () => {
      expect(sc.parseEpisodeFilename("Show - s01e01.mkv").ext).toBe(".mkv");
    });

    it("extrai extensão .mp4", () => {
      expect(sc.parseEpisodeFilename("Show - s01e01.mp4").ext).toBe(".mp4");
    });

    it("extrai extensão .avi", () => {
      expect(sc.parseEpisodeFilename("Show - s01e01.avi").ext).toBe(".avi");
    });
  });

  // ─── Episódio baseado em data ────────────────────────────────────────────────

  describe("episódios baseados em data", () => {
    it("detecta formato YYYY-MM-DD", () => {
      const r = sc.parseEpisodeFilename("The Colbert Report (2005) - 2011-11-15 - Elijah Wood.avi");
      expect(r.dateBased).toBe(true);
      expect(r.airDate).toBe("2011-11-15");
    });

    it("retorna dateBased=false para episódios padrão", () => {
      const r = sc.parseEpisodeFilename("Night Sky - s01e01.mkv");
      expect(r.dateBased).toBe(false);
    });
  });

  // ─── Specials (season 00) ────────────────────────────────────────────────────

  describe("specials (season 00)", () => {
    it("detecta season 00 como special", () => {
      const r = sc.parseEpisodeFilename("Grey's Anatomy (2005) - s00e01 - Straight to the Heart.mkv");
      expect(r.season).toBe(0);
      expect(r.isSpecial).toBe(true);
    });

    it("não marca como special episódios de temporadas normais", () => {
      const r = sc.parseEpisodeFilename("Show - s01e01.mkv");
      expect(r.isSpecial).toBe(false);
    });
  });

  // ─── Arquivo não reconhecido ─────────────────────────────────────────────────

  describe("arquivo não reconhecido", () => {
    it("retorna null para arquivo sem padrão de episódio", () => {
      const r = sc.parseEpisodeFilename("some-random-file.mkv");
      expect(r).toBeNull();
    });
  });
});
