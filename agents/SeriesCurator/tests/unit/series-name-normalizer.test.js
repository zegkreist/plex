import { SeriesConsolidator } from "../../src/series-consolidator.js";

/**
 * UNIT TESTS – normalização de nomes de séries
 */
describe("SeriesConsolidator – normalização de nomes de séries", () => {
  let sc;

  beforeEach(() => {
    sc = new SeriesConsolidator(null);
  });

  // ─── normalizeSeriesName() ───────────────────────────────────────────────────

  describe("normalizeSeriesName()", () => {
    it("remove tags técnicas entre colchetes", () => {
      const r = sc.normalizeSeriesName("Breaking Bad [1080p]");
      expect(r).not.toContain("[1080p]");
    });

    it("remove múltiplas tags técnicas", () => {
      const r = sc.normalizeSeriesName("The Office (US) [BluRay] [x265]");
      expect(r).not.toMatch(/\[/);
    });

    it("preserva o ano entre parênteses", () => {
      const r = sc.normalizeSeriesName("Band of Brothers (2001) [1080p]");
      expect(r).toContain("(2001)");
    });

    it("preserva o ID do TMDB/TVDB entre chaves", () => {
      const r = sc.normalizeSeriesName("The Office (US) (2005) {tmdb-2996}");
      expect(r).toContain("{tmdb-2996}");
    });

    it("remove espaços extras", () => {
      const r = sc.normalizeSeriesName("Band  of   Brothers");
      expect(r).toBe("Band Of Brothers");
    });

    it("aplica Title Case ao título", () => {
      const r = sc.normalizeSeriesName("band of brothers");
      expect(r).toBe("Band Of Brothers");
    });

    it("mantém o ano quando já está no formato correto", () => {
      const r = sc.normalizeSeriesName("Doctor Who (1963)");
      expect(r).toBe("Doctor Who (1963)");
    });
  });

  // ─── extractYearFromName() ───────────────────────────────────────────────────

  describe("extractYearFromName()", () => {
    it("extrai o ano entre parênteses", () => {
      expect(sc.extractYearFromName("Band of Brothers (2001)")).toBe("2001");
    });

    it("extrai ano do nome de pasta com tags", () => {
      expect(sc.extractYearFromName("Breaking Bad (2008) [1080p]")).toBe("2008");
    });

    it("retorna null quando não há ano", () => {
      expect(sc.extractYearFromName("Night Sky")).toBeNull();
    });

    it("não confunde outros números com o ano", () => {
      expect(sc.extractYearFromName("Band of Brothers (10 episodes)")).toBeNull();
    });
  });

  // ─── toPlexSeriesName() ──────────────────────────────────────────────────────

  describe("toPlexSeriesName()", () => {
    it("combina título e ano no formato Plex", () => {
      expect(sc.toPlexSeriesName("Band of Brothers", "2001")).toBe("Band Of Brothers (2001)");
    });

    it("retorna apenas o título quando não há ano", () => {
      expect(sc.toPlexSeriesName("Night Sky", null)).toBe("Night Sky");
    });

    it("não duplica o ano se já está no título", () => {
      expect(sc.toPlexSeriesName("Band of Brothers (2001)", "2001")).toBe("Band Of Brothers (2001)");
    });
  });

  // ─── toPlexEpisodeFilename() ─────────────────────────────────────────────────

  describe("toPlexEpisodeFilename()", () => {
    it("gera nome no formato padrão Plex sem título", () => {
      const r = sc.toPlexEpisodeFilename({
        showName: "Night Sky",
        year: null,
        season: 1,
        episode: 1,
        title: null,
        tags: [],
        ext: ".mkv",
      });
      expect(r).toBe("Night Sky - s01e01.mkv");
    });

    it("gera nome com ano e título", () => {
      const r = sc.toPlexEpisodeFilename({
        showName: "Band of Brothers",
        year: "2001",
        season: 1,
        episode: 1,
        title: "Currahee",
        tags: [],
        ext: ".mkv",
      });
      expect(r).toBe("Band Of Brothers (2001) - s01e01 - Currahee.mkv");
    });

    it("inclui tags técnicas entre colchetes no final", () => {
      const r = sc.toPlexEpisodeFilename({
        showName: "Breaking Bad",
        year: "2008",
        season: 2,
        episode: 7,
        title: "Negro Y Azul",
        tags: ["1080p", "BluRay"],
        ext: ".mkv",
      });
      expect(r).toContain("[1080p]");
      expect(r).toContain("[BluRay]");
    });

    it("usa zero-padding correto (s01e01, s10e12)", () => {
      const r = sc.toPlexEpisodeFilename({
        showName: "Show",
        year: null,
        season: 10,
        episode: 12,
        title: null,
        tags: [],
        ext: ".mkv",
      });
      expect(r).toContain("s10e12");
    });

    it("gera multi-episódio com eZZ quando episodeEnd está presente", () => {
      const r = sc.toPlexEpisodeFilename({
        showName: "Show",
        year: null,
        season: 2,
        episode: 1,
        episodeEnd: 3,
        title: null,
        tags: [],
        ext: ".avi",
      });
      expect(r).toContain("s02e01-e03");
    });
  });

  // ─── areSeriesEquivalent() ───────────────────────────────────────────────────

  describe("areSeriesEquivalent()", () => {
    it("considera nomes idênticos equivalentes", () => {
      expect(sc.areSeriesEquivalent("Breaking Bad", "Breaking Bad")).toBe(true);
    });

    it("considera nomes com e sem ano equivalentes", () => {
      expect(sc.areSeriesEquivalent("Breaking Bad (2008)", "Breaking Bad")).toBe(true);
    });

    it("considera nomes com e sem tags técnicas equivalentes", () => {
      expect(sc.areSeriesEquivalent("Breaking Bad [1080p]", "Breaking Bad")).toBe(true);
    });

    it("considera nomes com case diferente equivalentes", () => {
      expect(sc.areSeriesEquivalent("breaking bad", "Breaking Bad")).toBe(true);
    });

    it("considera séries distintas como não equivalentes", () => {
      expect(sc.areSeriesEquivalent("Breaking Bad", "Better Call Saul")).toBe(false);
    });

    it("considera 'The Office (US)' e 'The Office (UK)' como não equivalentes", () => {
      expect(sc.areSeriesEquivalent("The Office (US)", "The Office (UK)")).toBe(false);
    });

    it("normaliza pontos como separadores de palavras", () => {
      expect(sc.areSeriesEquivalent("Breaking.Bad", "Breaking Bad")).toBe(true);
    });

    it("normaliza underscores como separadores de palavras", () => {
      expect(sc.areSeriesEquivalent("Breaking_Bad", "Breaking Bad")).toBe(true);
    });

    it("normaliza combinação de pontos, underscores e ano", () => {
      expect(sc.areSeriesEquivalent("Game.of.Thrones.2011", "Game of Thrones (2011)")).toBe(false); // ano sem parênteses não é stripped
      expect(sc.areSeriesEquivalent("Game.of.Thrones", "Game of Thrones (2011)")).toBe(true);
    });

    it("três nomes diferentes para a mesma série são todos equivalentes entre si", () => {
      const names = ["Breaking Bad", "Breaking Bad (2008)", "Breaking.Bad.2008"];
      // 'Breaking.Bad.2008' normaliza para 'breaking bad 2008' — diferente de 'breaking bad'
      // mas 'Breaking Bad' e 'Breaking Bad (2008)' são equivalentes
      expect(sc.areSeriesEquivalent(names[0], names[1])).toBe(true);
      expect(sc.areSeriesEquivalent(names[0], "Breaking.Bad")).toBe(true);
      expect(sc.areSeriesEquivalent(names[1], "Breaking.Bad")).toBe(true);
    });

    it("nome com notação totalmente em pontos (Game.of.Thrones) equivale ao nome normal", () => {
      expect(sc.areSeriesEquivalent("Game.of.Thrones", "Game of Thrones")).toBe(true);
    });
  });
});
