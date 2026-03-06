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

// ─── cleanAlbumName ───────────────────────────────────────────────────────────

describe("cleanAlbumName", () => {
  test("remove tag [FLAC]", () => {
    expect(organizer.cleanAlbumName("OK Computer [FLAC]")).toBe("OK Computer");
  });

  test("remove (Year) seguido de [FLAC]", () => {
    expect(organizer.cleanAlbumName("OK Computer (1997) [FLAC]")).toBe("OK Computer");
  });

  test("remove [24bit Hi-Res Web]", () => {
    expect(organizer.cleanAlbumName("Dark Side of the Moon [24bit Hi-Res Web]")).toBe("Dark Side of the Moon");
  });

  test("remove Remastered no final", () => {
    expect(organizer.cleanAlbumName("Demolition Remastered")).toBe("Demolition");
  });

  test("remove (Deluxe Edition) no final", () => {
    expect(organizer.cleanAlbumName("In Utero (Deluxe Edition)")).toBe("In Utero");
  });

  test("remove Anniversary Edition no final", () => {
    expect(organizer.cleanAlbumName("Abbey Road Anniversary Edition")).toBe("Abbey Road");
  });

  test("preserva nome simples sem tags", () => {
    expect(organizer.cleanAlbumName("The Wall")).toBe("The Wall");
  });
});

// ─── isLiveRecording ──────────────────────────────────────────────────────────

describe("isLiveRecording", () => {
  test("detecta 'live' como palavra completa", () => {
    expect(organizer.isLiveRecording("Live at Wembley")).toBe(true);
  });

  test("detecta '(live)'", () => {
    expect(organizer.isLiveRecording("OK Computer (live)")).toBe(true);
  });

  test("detecta 'ao vivo' com espaço", () => {
    expect(organizer.isLiveRecording("Ao Vivo no Maracanã")).toBe(true);
  });

  test("detecta 'ao-vivo' com hífen", () => {
    expect(organizer.isLiveRecording("Show ao-vivo 2001")).toBe(true);
  });

  test("não detecta álbum de estúdio", () => {
    expect(organizer.isLiveRecording("OK Computer")).toBe(false);
  });

  test("não detecta 'alive' (live não é palavra completa)", () => {
    expect(organizer.isLiveRecording("Alive")).toBe(false);
  });

  test("retorna false para string vazia ou null", () => {
    expect(organizer.isLiveRecording("")).toBe(false);
    expect(organizer.isLiveRecording(null)).toBe(false);
  });
});

// ─── normalizeForComparison ───────────────────────────────────────────────────

describe("normalizeForComparison", () => {
  test("remove (Remastered)", () => {
    expect(organizer.normalizeForComparison("OK Computer (Remastered)")).toBe("okcomputer");
  });

  test("remove ano solto", () => {
    expect(organizer.normalizeForComparison("OK Computer 1997")).toBe("okcomputer");
  });

  test("remove (Deluxe Edition)", () => {
    expect(organizer.normalizeForComparison("In Utero (Deluxe Edition)")).toBe("inutero");
  });

  test("remove (live)", () => {
    expect(organizer.normalizeForComparison("Nevermind (live)")).toBe("nevermind");
  });

  test("remove acentos", () => {
    expect(organizer.normalizeForComparison("Música")).toBe("musica");
  });

  test("variantes do mesmo álbum normalizam igual", () => {
    const variants = [
      "OK Computer",
      "OK Computer (Remastered)",
      "OK Computer 1997",
      "OK Computer (Deluxe Edition)",
    ];
    const normalized = variants.map((v) => organizer.normalizeForComparison(v));
    expect(new Set(normalized).size).toBe(1);
  });
});

// ─── calculateSimilarity ─────────────────────────────────────────────────────

describe("calculateSimilarity", () => {
  test("strings idênticas retornam 1.0", () => {
    expect(organizer.calculateSimilarity("okcomputer", "okcomputer")).toBe(1.0);
  });

  test("strings completamente diferentes retornam valor baixo", () => {
    expect(organizer.calculateSimilarity("abc", "xyz")).toBeLessThan(0.5);
  });

  test("strings quase iguais retornam valor ≥ 0.85", () => {
    // "okcomputer" vs "okcomputer2" — diferem por 1 char
    expect(organizer.calculateSimilarity("okcomputer", "okcomputer2")).toBeGreaterThan(0.85);
  });

  test("strings vazias retornam 1.0", () => {
    expect(organizer.calculateSimilarity("", "")).toBe(1.0);
  });
});

// ─── findExistingAlbumDir ─────────────────────────────────────────────────────

describe("findExistingAlbumDir", () => {
  test("encontra pasta com nome exato no filesystem", () => {
    const artistDir = path.join(dirs.destMusic, "Radiohead");
    const albumDir = path.join(artistDir, "OK Computer");
    fs.mkdirSync(albumDir, { recursive: true });

    const result = organizer.findExistingAlbumDir("Radiohead", "OK Computer", artistDir, new Map());
    expect(result).toBe(albumDir);
  });

  test("encontra pasta remastered quando procuramos pelo nome limpo", () => {
    const artistDir = path.join(dirs.destMusic, "Radiohead");
    const albumDir = path.join(artistDir, "OK Computer Remastered");
    fs.mkdirSync(albumDir, { recursive: true });

    // "OK Computer" e "OK Computer Remastered" normalizam para "okcomputer"
    const result = organizer.findExistingAlbumDir("Radiohead", "OK Computer", artistDir, new Map());
    expect(result).toBe(albumDir);
  });

  test("encontra álbum já no processedAlbums da sessão", () => {
    const albumPath = path.join(dirs.destMusic, "Radiohead", "OK Computer");
    const processedAlbums = new Map([
      ["Radiohead/OK Computer", { artist: "Radiohead", albumName: "OK Computer", path: albumPath }],
    ]);

    const artistDir = path.join(dirs.destMusic, "Radiohead");
    const result = organizer.findExistingAlbumDir("Radiohead", "OK Computer", artistDir, processedAlbums);
    expect(result).toBe(albumPath);
  });

  test("retorna null quando não há pasta compatível", () => {
    const artistDir = path.join(dirs.destMusic, "Radiohead");
    fs.mkdirSync(artistDir, { recursive: true });

    const result = organizer.findExistingAlbumDir("Radiohead", "The Bends", artistDir, new Map());
    expect(result).toBeNull();
  });

  test("não confunde artistas diferentes", () => {
    const rhDir = path.join(dirs.destMusic, "Radiohead");
    fs.mkdirSync(path.join(rhDir, "OK Computer"), { recursive: true });

    const artistDir = path.join(dirs.destMusic, "Portishead");
    const result = organizer.findExistingAlbumDir("Portishead", "OK Computer", artistDir, new Map());
    // artistDir de Portishead não existe, deve retornar null
    expect(result).toBeNull();
  });
});

// ─── organizeMusic — deduplicação e live ─────────────────────────────────────

describe("organizeMusic — live e deduplicação", () => {
  test("pasta com nome live ganha sufixo (Live) se o álbum não continha a palavra", async () => {
    // Pasta "Nirvana - Live at Reading" — a word "live" está no PATH mas não diretamente no album name
    // parseAlbumFolderName → artist: "Nirvana", album: "Live at Reading" (live já está no album)
    // isLiveRecording("Live at Reading") = true → albumFolderName = "Live at Reading"
    touch(path.join(dirs.sourceMusic, "Nirvana - Live at Reading", "01.flac"));
    await organizer.organize();

    const artistDir = path.join(dirs.destMusic, "Nirvana");
    const subdirs = fs.readdirSync(artistDir);
    expect(subdirs.some((d) => d.toLowerCase().includes("live") || d.toLowerCase().includes("reading"))).toBe(true);
  });

  test("dois downloads do mesmo álbum são mesclados na mesma pasta destino", async () => {
    touch(path.join(dirs.sourceMusic, "Radiohead - OK Computer", "01.flac"));
    touch(path.join(dirs.sourceMusic, "Radiohead - OK Computer (Remastered)", "02.flac"));

    await organizer.organize();

    const artistDir = path.join(dirs.destMusic, "Radiohead");
    const subdirs = fs.readdirSync(artistDir).filter((d) =>
      fs.statSync(path.join(artistDir, d)).isDirectory()
    );
    // Ambas as faixas devem cair na mesma pasta
    expect(subdirs).toHaveLength(1);
    const albumFiles = fs.readdirSync(path.join(artistDir, subdirs[0]));
    expect(albumFiles.filter((f) => f.endsWith(".flac"))).toHaveLength(2);
  });

  test("álbuns de artistas diferentes não são mesclados", async () => {
    touch(path.join(dirs.sourceMusic, "Radiohead - OK Computer", "01.flac"));
    touch(path.join(dirs.sourceMusic, "Portishead - OK Computer", "01.flac"));

    await organizer.organize();

    const rhDir = path.join(dirs.destMusic, "Radiohead");
    const phDir = path.join(dirs.destMusic, "Portishead");
    expect(fs.existsSync(rhDir)).toBe(true);
    expect(fs.existsSync(phDir)).toBe(true);
  });
});

// ─── paths relativas — sem config.plex ───────────────────────────────────────

describe("paths relativas — sem config.plex", () => {
  test("destMovies fallback aponta para REPO_ROOT/movies (não plex_server_movie hardcoded)", () => {
    const org = new PlexOrganizer({ downloads: { movies: ".", series: ".", music: "." } });
    // Antes era pasta irmã errada: plex_server_movie — agora deve ser subdir do repo
    expect(org.destMovies).not.toMatch(/plex_server_movie/);
    expect(org.destMovies).toMatch(/plex_server\/movies$/);
  });

  test("destSeries fallback aponta para REPO_ROOT/tv", () => {
    const org = new PlexOrganizer({ downloads: { movies: ".", series: ".", music: "." } });
    expect(org.destSeries).toMatch(/plex_server\/tv$/);
  });

  test("destMusic fallback aponta para REPO_ROOT/music", () => {
    const org = new PlexOrganizer({ downloads: { movies: ".", series: ".", music: "." } });
    expect(org.destMusic).toMatch(/plex_server\/music$/);
  });

  test("MOVIES_PATH env var sobrescreve fallback", () => {
    process.env.MOVIES_PATH = "/custom/movies";
    const org = new PlexOrganizer({ downloads: { movies: ".", series: ".", music: "." } });
    expect(org.destMovies).toBe("/custom/movies");
    delete process.env.MOVIES_PATH;
  });
});
