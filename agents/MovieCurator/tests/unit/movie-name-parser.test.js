import { MovieConsolidator } from "../../src/movie-consolidator.js";

/**
 * UNIT TESTS – parseMovieFilename()
 *
 * Cobre os formatos descritos no naming guide do Plex:
 * https://support.plex.tv/articles/naming-and-organizing-your-movie-files/
 *
 * Format padrão Plex: Movie Name (Year)/Movie Name (Year).ext
 * Com ID: Movie Name (Year) {imdb-ttXXXXXXX}/...
 */
describe("MovieConsolidator – parseMovieFilename()", () => {
  let mc;

  beforeEach(() => {
    mc = new MovieConsolidator(null);
  });

  // ─── Formato Plex padrão: "Movie Name (Year).ext" ────────────────────────

  describe("formato padrão com ano entre parênteses", () => {
    it("extrai título e ano do formato 'Movie Name (2009).mkv'", () => {
      const r = mc.parseMovieFilename("Avatar (2009).mkv");
      expect(r.title).toBe("Avatar");
      expect(r.year).toBe("2009");
      expect(r.ext).toBe(".mkv");
    });

    it("extrai título com múltiplas palavras", () => {
      const r = mc.parseMovieFilename("The Dark Knight (2008).mkv");
      expect(r.title).toBe("The Dark Knight");
      expect(r.year).toBe("2008");
    });

    it("extrai título com apóstrofo", () => {
      const r = mc.parseMovieFilename("Schindler's List (1993).mkv");
      expect(r.title).toBe("Schindler's List");
      expect(r.year).toBe("1993");
    });

    it("extrai título com dois pontos", () => {
      const r = mc.parseMovieFilename("Batman Begins (2005).mp4");
      expect(r.title).toBe("Batman Begins");
      expect(r.year).toBe("2005");
      expect(r.ext).toBe(".mp4");
    });

    it("retorna imdbId e tmdbId null quando não há tags de ID", () => {
      const r = mc.parseMovieFilename("Avatar (2009).mkv");
      expect(r.imdbId).toBeNull();
      expect(r.tmdbId).toBeNull();
    });
  });

  // ─── Formato com ponto separando (dot-separated) ────────────────────────

  describe("formato separado por pontos", () => {
    it("converte pontos em espaços e extrai ano", () => {
      const r = mc.parseMovieFilename("The.Dark.Knight.2008.1080p.BluRay.mkv");
      expect(r.title).toBe("The Dark Knight");
      expect(r.year).toBe("2008");
    });

    it("extrai título com underscores", () => {
      const r = mc.parseMovieFilename("The_Dark_Knight_2008_1080p.mkv");
      expect(r.title).toBe("The Dark Knight");
      expect(r.year).toBe("2008");
    });

    it("converte pontos corretamente mesmo sem qualidade", () => {
      const r = mc.parseMovieFilename("Avatar.2009.mkv");
      expect(r.title).toBe("Avatar");
      expect(r.year).toBe("2009");
    });
  });

  // ─── Tags de qualidade são removidas ────────────────────────────────────

  describe("remoção de tags de qualidade", () => {
    it("remove '1080p' do título", () => {
      const r = mc.parseMovieFilename("Movie Name (2009) 1080p.mkv");
      expect(r.title).toBe("Movie Name");
      expect(r.year).toBe("2009");
    });

    it("remove 'BluRay' do título", () => {
      const r = mc.parseMovieFilename("Avatar (2009) BluRay.mkv");
      expect(r.title).toBe("Avatar");
    });

    it("remove 'WEB-DL' do título", () => {
      const r = mc.parseMovieFilename("The Dark Knight (2008) WEB-DL.mkv");
      expect(r.title).toBe("The Dark Knight");
    });

    it("remove 'x265' e outros codecs do título", () => {
      const r = mc.parseMovieFilename("Movie Name 2009 x265.mkv");
      expect(r.title).toBe("Movie Name");
    });

    it("remove tags de grupo de release (YIFY, RARBG)", () => {
      const r = mc.parseMovieFilename("Avatar.2009.1080p.BluRay.x264-YIFY.mkv");
      expect(r.title).toBe("Avatar");
      expect(r.year).toBe("2009");
    });
  });

  // ─── Tags de ID (IMDB / TMDB) ───────────────────────────────────────────

  describe("tags de ID externas", () => {
    it("extrai imdbId de '{imdb-tt0499549}'", () => {
      const r = mc.parseMovieFilename("Avatar (2009) {imdb-tt0499549}.mkv");
      expect(r.imdbId).toBe("tt0499549");
      expect(r.title).toBe("Avatar");
      expect(r.year).toBe("2009");
    });

    it("extrai tmdbId de '{tmdb-19995}'", () => {
      const r = mc.parseMovieFilename("Avatar (2009) {tmdb-19995}.mkv");
      expect(r.tmdbId).toBe("19995");
      expect(r.title).toBe("Avatar");
    });

    it("extrai ambos imdbId e tmdbId quando presentes", () => {
      const r = mc.parseMovieFilename(
        "Avatar (2009) {imdb-tt0499549} {tmdb-19995}.mkv"
      );
      expect(r.imdbId).toBe("tt0499549");
      expect(r.tmdbId).toBe("19995");
    });

    it("retorna imdbId null quando tag não presente", () => {
      const r = mc.parseMovieFilename("Avatar (2009).mkv");
      expect(r.imdbId).toBeNull();
    });
  });

  // ─── Filmes sem ano ──────────────────────────────────────────────────────

  describe("filmes sem ano", () => {
    it("retorna year null quando não há ano", () => {
      const r = mc.parseMovieFilename("Metropolis.mkv");
      expect(r.title).toBe("Metropolis");
      expect(r.year).toBeNull();
    });

    it("ainda extrai o título corretamente sem ano", () => {
      const r = mc.parseMovieFilename("The Adventures of Robin Hood.mkv");
      expect(r.title).toBe("The Adventures of Robin Hood");
      expect(r.year).toBeNull();
    });
  });

  // ─── Extensões de vídeo suportadas ──────────────────────────────────────

  describe("extensões de arquivo", () => {
    it("preserva extensão .mkv", () => {
      expect(mc.parseMovieFilename("Movie (2009).mkv").ext).toBe(".mkv");
    });

    it("preserva extensão .mp4", () => {
      expect(mc.parseMovieFilename("Movie (2009).mp4").ext).toBe(".mp4");
    });

    it("preserva extensão .avi", () => {
      expect(mc.parseMovieFilename("Movie (2009).avi").ext).toBe(".avi");
    });

    it("preserva extensão .m4v", () => {
      expect(mc.parseMovieFilename("Movie (2009).m4v").ext).toBe(".m4v");
    });
  });

  // ─── Casos extremos ──────────────────────────────────────────────────────

  describe("casos extremos", () => {
    it("retorna null para filename vazio", () => {
      expect(mc.parseMovieFilename("")).toBeNull();
    });

    it("retorna null para arquivo sem extensão de vídeo reconhecida", () => {
      expect(mc.parseMovieFilename("document.pdf")).toBeNull();
    });

    it("aceita ano entre colchetes no formato [2009]", () => {
      const r = mc.parseMovieFilename("Avatar [2009].mkv");
      expect(r.year).toBe("2009");
      expect(r.title).toBe("Avatar");
    });
  });
});
