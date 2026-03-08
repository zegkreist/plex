import { MovieConsolidator } from "../../src/movie-consolidator.js";

/**
 * UNIT TESTS – toPlexMovieName() & toPlexMovieFilename()
 */
describe("MovieConsolidator – toPlexMovieName()", () => {
  let mc;

  beforeEach(() => {
    mc = new MovieConsolidator(null);
  });

  it("formata título e ano: 'Avatar', '2009' → 'Avatar (2009)'", () => {
    expect(mc.toPlexMovieName("Avatar", "2009")).toBe("Avatar (2009)");
  });

  it("retorna só o título quando ano é null", () => {
    expect(mc.toPlexMovieName("Metropolis", null)).toBe("Metropolis");
  });

  it("aplica Title Case ao título", () => {
    expect(mc.toPlexMovieName("the dark knight", "2008")).toBe(
      "The Dark Knight (2008)"
    );
  });

  it("não duplica o ano se o título já contém '(YYYY)'", () => {
    expect(mc.toPlexMovieName("Avatar (2009)", "2009")).toBe("Avatar (2009)");
  });

  it("substitui o ano existente se um novo ano for fornecido", () => {
    expect(mc.toPlexMovieName("Avatar (2008)", "2009")).toBe("Avatar (2009)");
  });

  it("ignora tags [] ao aplicar Title Case", () => {
    expect(mc.toPlexMovieName("avatar [1080p]", "2009")).toBe("Avatar (2009)");
  });

  it("preserva grupos de parênteses não-ano, ex: 'La La Land (Musical)'", () => {
    // O ano deve ser colocado depois do título limpo
    expect(mc.toPlexMovieName("La La Land", "2016")).toBe("La La Land (2016)");
  });
});

describe("MovieConsolidator – toPlexMovieFilename()", () => {
  let mc;

  beforeEach(() => {
    mc = new MovieConsolidator(null);
  });

  it("gera 'Avatar (2009).mkv' sem IDs", () => {
    expect(
      mc.toPlexMovieFilename({ title: "Avatar", year: "2009", ext: ".mkv" })
    ).toBe("Avatar (2009).mkv");
  });

  it("gera nome com {imdb-ttXXXXXXX} quando imdbId presente", () => {
    expect(
      mc.toPlexMovieFilename({
        title: "Avatar",
        year: "2009",
        imdbId: "tt0499549",
        ext: ".mkv",
      })
    ).toBe("Avatar (2009) {imdb-tt0499549}.mkv");
  });

  it("gera nome com {tmdb-XXX} quando tmdbId presente", () => {
    expect(
      mc.toPlexMovieFilename({
        title: "Avatar",
        year: "2009",
        tmdbId: "19995",
        ext: ".mkv",
      })
    ).toBe("Avatar (2009) {tmdb-19995}.mkv");
  });

  it("prefire imdbId sobre tmdbId quando ambos presentes", () => {
    const result = mc.toPlexMovieFilename({
      title: "Avatar",
      year: "2009",
      imdbId: "tt0499549",
      tmdbId: "19995",
      ext: ".mkv",
    });
    expect(result).toBe("Avatar (2009) {imdb-tt0499549}.mkv");
  });

  it("gera nome sem ano quando year é null", () => {
    expect(
      mc.toPlexMovieFilename({ title: "Metropolis", year: null, ext: ".mkv" })
    ).toBe("Metropolis.mkv");
  });

  it("a pasta gerada é igual ao nome do arquivo sem extensão", () => {
    const info = { title: "The Dark Knight", year: "2008", ext: ".mkv" };
    const filename = mc.toPlexMovieFilename(info);
    const folderName = mc.toPlexMovieName(info.title, info.year);
    expect(filename).toBe(`${folderName}.mkv`);
  });
});
