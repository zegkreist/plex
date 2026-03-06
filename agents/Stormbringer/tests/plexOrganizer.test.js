import fs from "fs";
import path from "path";
import os from "os";
import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
import PlexOrganizer from "../src/plexOrganizer.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "plex-test-"));
}

function touch(filePath, content = "") {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

/** Cria um config apontando para diretórios temporários */
function makeConfig(dirs) {
  return {
    downloads: {
      movies: dirs.sourceMovies,
      series: dirs.sourceSeries,
      music: dirs.sourceMusic,
    },
    plex: {
      movies: dirs.destMovies,
      series: dirs.destSeries,
      music: dirs.destMusic,
    },
  };
}

/** Remove diretório temporário recursivamente */
function rmrf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

let tmp;
let dirs;
let organizer;

beforeEach(() => {
  tmp = makeTmp();
  dirs = {
    sourceMovies: path.join(tmp, "downloads/filmes"),
    sourceSeries: path.join(tmp, "downloads/series"),
    sourceMusic: path.join(tmp, "downloads/musicas"),
    destMovies: path.join(tmp, "plex/movies"),
    destSeries: path.join(tmp, "plex/tv"),
    destMusic: path.join(tmp, "plex/music"),
  };
  Object.values(dirs).forEach((d) => fs.mkdirSync(d, { recursive: true }));
  organizer = new PlexOrganizer(makeConfig(dirs));
});

afterEach(() => rmrf(tmp));

// ─── parseMovieName ───────────────────────────────────────────────────────────

describe("parseMovieName", () => {
  test("nome com ano entre parênteses", () => {
    const r = organizer.parseMovieName("The Matrix (1999).mkv");
    expect(r.name).toBe("The Matrix");
    expect(r.year).toBe("1999");
  });

  test("nome com pontos e ano inline", () => {
    const r = organizer.parseMovieName("Blade.Runner.2049.1080p.mkv");
    expect(r.name).toBe("Blade Runner");
    expect(r.year).toBe("2049");
  });

  test("sem ano", () => {
    const r = organizer.parseMovieName("Akira.mkv");
    expect(r.name).toBe("Akira");
    expect(r.year).toBeNull();
  });

  test("com tags de qualidade removidas", () => {
    const r = organizer.parseMovieName("Interstellar.2014.1080p.BluRay.x264-YIFY.mkv");
    expect(r.name).toBe("Interstellar");
    expect(r.year).toBe("2014");
  });
});

// ─── parseEpisodeName ─────────────────────────────────────────────────────────

describe("parseEpisodeName", () => {
  test("padrão S01E01", () => {
    const r = organizer.parseEpisodeName("Breaking.Bad.S01E01.720p.mkv");
    expect(r.showName).toBe("Breaking Bad");
    expect(r.season).toBe(1);
    expect(r.episode).toBe(1);
  });

  test("padrão 1x01", () => {
    const r = organizer.parseEpisodeName("The.Wire.1x05.mkv");
    expect(r.showName).toBe("The Wire");
    expect(r.season).toBe(1);
    expect(r.episode).toBe(5);
  });

  test("extrai título do episódio", () => {
    const r = organizer.parseEpisodeName("Sopranos.S02E03.Toodle-Fucking-Oo.mkv");
    expect(r.showName).toBe("Sopranos");
    expect(r.episodeTitle).toBe("Toodle-Fucking-Oo");
  });

  test("retorna null se não tem padrão de episódio", () => {
    expect(organizer.parseEpisodeName("random.mkv")).toBeNull();
  });
});

// ─── parseAlbumFolderName ─────────────────────────────────────────────────────

describe("parseAlbumFolderName", () => {
  test("Artist - Year - Album", () => {
    const r = organizer.parseAlbumFolderName("Judas Priest - 2001 - Demolition");
    expect(r.artist).toBe("Judas Priest");
    expect(r.year).toBe("2001");
    expect(r.album).toBe("Demolition");
  });

  test("Artist - Album (Year) [FLAC]", () => {
    const r = organizer.parseAlbumFolderName("Radiohead - OK Computer (1997) [FLAC]");
    expect(r.artist).toBe("Radiohead");
    expect(r.year).toBe("1997");
    expect(r.album).toBe("OK Computer");
  });

  test("Artist - Album (Year,qualidade, número solto)", () => {
    const r = organizer.parseAlbumFolderName("Radiohead - OK Computer (1997,2009 Deluxe) [FLAC] 88");
    expect(r.artist).toBe("Radiohead");
    expect(r.year).toBe("1997");
    expect(r.album).toBe("OK Computer");
  });

  test("Artist - Album sem ano", () => {
    const r = organizer.parseAlbumFolderName("Pink Floyd - The Wall");
    expect(r.artist).toBe("Pink Floyd");
    expect(r.year).toBeNull();
    expect(r.album).toBe("The Wall");
  });

  test("sem hífen — fallback Unknown Artist", () => {
    const r = organizer.parseAlbumFolderName("SomeRandomAlbum");
    expect(r.artist).toBe("Unknown Artist");
    expect(r.album).toBe("SomeRandomAlbum");
  });
});

// ─── isReleaseFolder ──────────────────────────────────────────────────────────

describe("isReleaseFolder", () => {
  test("pasta com .flac direto → release", () => {
    const dir = path.join(tmp, "album");
    touch(path.join(dir, "01.flac"));
    expect(organizer.isReleaseFolder(dir)).toBe(true);
  });

  test("pasta com CD 1/tracks → release", () => {
    const dir = path.join(tmp, "multi");
    touch(path.join(dir, "CD 1", "01.flac"));
    expect(organizer.isReleaseFolder(dir)).toBe(true);
  });

  test("pasta com apenas subpastas de álbuns → artista (não release)", () => {
    const dir = path.join(tmp, "artist");
    // Subpasta sem áudio direto, não segue padrão Disc
    touch(path.join(dir, "Album A", "01.flac"));
    expect(organizer.isReleaseFolder(dir)).toBe(false);
  });
});

// ─── dryRun — filmes ──────────────────────────────────────────────────────────

describe("dryRun — filmes", () => {
  test("detecta filme e gera plano correto", async () => {
    touch(path.join(dirs.sourceMovies, "The Matrix (1999)", "The.Matrix.1999.mkv"));

    const plan = await organizer.dryRun();
    const movies = plan.filter((p) => p.type === "movie");

    expect(movies).toHaveLength(1);
    expect(movies[0].label).toBe("The Matrix (1999)");
    expect(movies[0].source).toContain("The.Matrix.1999.mkv");
    expect(movies[0].dest).toContain("The Matrix (1999)");
  });

  test("não move arquivos no dry-run", async () => {
    const src = path.join(dirs.sourceMovies, "Akira (1988)", "Akira.1988.mkv");
    touch(src);

    await organizer.dryRun();

    expect(fs.existsSync(src)).toBe(true); // ainda no lugar original
  });
});

// ─── dryRun — séries ──────────────────────────────────────────────────────────

describe("dryRun — séries", () => {
  test("detecta episódio e gera destino Plex correto", async () => {
    touch(path.join(dirs.sourceSeries, "Breaking Bad", "Breaking.Bad.S01E01.720p.mkv"));

    const plan = await organizer.dryRun();
    const eps = plan.filter((p) => p.type === "series");

    expect(eps).toHaveLength(1);
    expect(eps[0].dest).toContain("Season 01");
    expect(eps[0].dest.toLowerCase()).toContain("breaking bad - s01e01");
  });
});

// ─── dryRun — música ──────────────────────────────────────────────────────────

describe("dryRun — música", () => {
  test("estrutura: musicas/Artist - Year - Album/tracks", async () => {
    touch(path.join(dirs.sourceMusic, "Judas Priest - 2001 - Demolition", "01.mp3"));
    touch(path.join(dirs.sourceMusic, "Judas Priest - 2001 - Demolition", "02.mp3"));

    const plan = await organizer.dryRun();
    const tracks = plan.filter((p) => p.type === "music");

    expect(tracks).toHaveLength(2);
    expect(tracks[0].dest).toContain("Judas Priest");
    expect(tracks[0].dest).toContain("Demolition (2001)");
  });

  test("estrutura: musicas/Artista/Album/tracks", async () => {
    touch(path.join(dirs.sourceMusic, "Pink Floyd", "The Wall", "01.flac"));

    const plan = await organizer.dryRun();
    const tracks = plan.filter((p) => p.type === "music");

    expect(tracks).toHaveLength(1);
    expect(tracks[0].label).toContain("Pink Floyd");
    expect(tracks[0].dest).toContain("The Wall");
  });

  test("estrutura: musicas/Artist - Album/CD 1/tracks (multi-disco)", async () => {
    touch(path.join(dirs.sourceMusic, "The Beatles - White Album", "CD 1", "01.flac"));
    touch(path.join(dirs.sourceMusic, "The Beatles - White Album", "CD 2", "01.flac"));

    const plan = await organizer.dryRun();
    const tracks = plan.filter((p) => p.type === "music");

    expect(tracks).toHaveLength(2);
    expect(tracks.some((t) => t.dest.includes("CD 1"))).toBe(true);
    expect(tracks.some((t) => t.dest.includes("CD 2"))).toBe(true);
  });
});

// ─── organize — move (não copia) ──────────────────────────────────────────────

describe("organize — move arquivos", () => {
  test("filme é movido e não permanece na origem", async () => {
    const src = path.join(dirs.sourceMovies, "Akira (1988)", "Akira.1988.mkv");
    touch(src);

    await organizer.organize();

    expect(fs.existsSync(src)).toBe(false); // saiu da origem
    // organizeMovieFile renomeia para "Folder Name.ext"
    const dest = path.join(dirs.destMovies, "Akira (1988)", "Akira (1988).mkv");
    expect(fs.existsSync(dest)).toBe(true); // chegou no destino
  });

  test("episódio é movido para estrutura Season", async () => {
    const src = path.join(dirs.sourceSeries, "Sopranos", "Sopranos.S01E01.mkv");
    touch(src);

    await organizer.organize();

    expect(fs.existsSync(src)).toBe(false);
    const destDir = path.join(dirs.destSeries, "Sopranos", "Season 01");
    expect(fs.existsSync(destDir)).toBe(true);
    expect(fs.readdirSync(destDir).length).toBeGreaterThan(0);
  });

  test("música (Artist - Year - Album) é movida para Artist/Album (Year)/", async () => {
    const src = path.join(dirs.sourceMusic, "Judas Priest - 2001 - Demolition", "01. Machine Man.mp3");
    touch(src);

    await organizer.organize();

    expect(fs.existsSync(src)).toBe(false);
    const dest = path.join(dirs.destMusic, "Judas Priest", "Demolition (2001)", "01. Machine Man.mp3");
    expect(fs.existsSync(dest)).toBe(true);
  });

  test("música (Artista/Album) é movida para Artist/Album/", async () => {
    const src = path.join(dirs.sourceMusic, "Pink Floyd", "The Wall", "01. In The Flesh.flac");
    touch(src);

    await organizer.organize();

    expect(fs.existsSync(src)).toBe(false);
    const dest = path.join(dirs.destMusic, "Pink Floyd", "The Wall", "01. In The Flesh.flac");
    expect(fs.existsSync(dest)).toBe(true);
  });

  test("multi-disco: preserva subpasta CD 1 / CD 2", async () => {
    touch(path.join(dirs.sourceMusic, "The Beatles - White Album", "CD 1", "01.flac"));
    touch(path.join(dirs.sourceMusic, "The Beatles - White Album", "CD 2", "01.flac"));

    await organizer.organize();

    const albumDir = path.join(dirs.destMusic, "The Beatles", "White Album");
    expect(fs.existsSync(path.join(albumDir, "CD 1", "01.flac"))).toBe(true);
    expect(fs.existsSync(path.join(albumDir, "CD 2", "01.flac"))).toBe(true);
  });

  test("pasta de origem vazia é removida após organizar", async () => {
    const albumDir = path.join(dirs.sourceMusic, "Nirvana - 1991 - Nevermind");
    touch(path.join(albumDir, "01.flac"));

    await organizer.organize();

    expect(fs.existsSync(albumDir)).toBe(false);
  });

  test("arquivo já existente no destino não é duplicado", async () => {
    const dest = path.join(dirs.destMusic, "Nirvana", "Nevermind (1991)", "01.flac");
    touch(dest, "original");
    touch(path.join(dirs.sourceMusic, "Nirvana - 1991 - Nevermind", "01.flac"), "novo");

    await organizer.organize();

    // Conteúdo original permanece (não sobrescreveu)
    expect(fs.readFileSync(dest, "utf8")).toBe("original");
  });
});
