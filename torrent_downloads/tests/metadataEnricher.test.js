import { describe, test, expect, beforeAll } from "@jest/globals";
import MetadataEnricher from "../src/metadataEnricher.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("MetadataEnricher - Testes de Integração", () => {
  let enricher;
  let enricherWithoutApi;
  const testOutputDir = path.join(__dirname, "test-output");

  beforeAll(() => {
    // Criar enricher com API (se configurada)
    const config = {
      metadata: {
        tmdbApiKey: process.env.TMDB_API_KEY || "", // Usa variável de ambiente se disponível
        enabled: true,
        downloadPosters: true,
        downloadFanart: true,
        createNFO: true,
        renameFiles: true,
      },
    };

    enricher = new MetadataEnricher(config);

    // Criar enricher sem API para testar fallback
    const configWithoutApi = { metadata: {} };
    enricherWithoutApi = new MetadataEnricher(configWithoutApi);

    // Criar diretório de teste
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  describe("Busca de Metadados de Filmes", () => {
    test("Deve buscar metadados de filme popular", async () => {
      const metadata = await enricher.getMovieMetadata("The Matrix", 1999);

      expect(metadata).toBeDefined();
      expect(metadata.title).toBeDefined();
      expect(metadata.title.toLowerCase()).toContain("matrix");
      expect(metadata.year).toBe(1999);

      if (enricher.tmdb) {
        expect(metadata.id).toBeDefined();
        expect(metadata.overview).toBeDefined();
        expect(metadata.rating).toBeGreaterThan(0);
      }
    }, 15000);

    test("Deve buscar filme sem ano", async () => {
      const metadata = await enricher.getMovieMetadata("Inception");

      expect(metadata).toBeDefined();
      expect(metadata.title).toBeDefined();
    }, 15000);

    test("Deve retornar metadados básicos para filme não encontrado", async () => {
      const metadata = await enricher.getMovieMetadata("FilmeInexistente123456789XYZ", 2099);

      expect(metadata).toBeDefined();
      expect(metadata.title).toBe("FilmeInexistente123456789XYZ");
      expect(metadata.year).toBe(2099);
    }, 15000);

    test("Deve funcionar sem API configurada (fallback)", async () => {
      const metadata = await enricherWithoutApi.getMovieMetadata("Test Movie", 2020);

      expect(metadata).toBeDefined();
      expect(metadata.title).toBe("Test Movie");
      expect(metadata.year).toBe(2020);
      expect(metadata.id).toBeNull();
    });
  });

  describe("Busca de Metadados de Séries", () => {
    test("Deve buscar metadados de série popular", async () => {
      const metadata = await enricher.getSeriesMetadata("Breaking Bad");

      expect(metadata).toBeDefined();
      expect(metadata.name).toBeDefined();
      expect(metadata.name.toLowerCase()).toContain("breaking bad");

      if (enricher.tmdb) {
        expect(metadata.id).toBeDefined();
        expect(metadata.numberOfSeasons).toBeGreaterThan(0);
        expect(metadata.numberOfEpisodes).toBeGreaterThan(0);
      }
    }, 15000);

    test("Deve buscar metadados de episódio específico", async () => {
      // Primeiro buscar a série
      const seriesMetadata = await enricher.getSeriesMetadata("Breaking Bad");

      if (seriesMetadata.id) {
        const episodeMetadata = await enricher.getEpisodeMetadata(seriesMetadata.id, 1, 1);

        expect(episodeMetadata).toBeDefined();
        if (episodeMetadata) {
          expect(episodeMetadata.name).toBeDefined();
          expect(episodeMetadata.seasonNumber).toBe(1);
          expect(episodeMetadata.episodeNumber).toBe(1);
        }
      }
    }, 20000);

    test("Deve buscar metadados de temporada", async () => {
      const seriesMetadata = await enricher.getSeriesMetadata("The Office");

      if (seriesMetadata.id) {
        const seasonMetadata = await enricher.getSeasonMetadata(seriesMetadata.id, 1);

        expect(seasonMetadata).toBeDefined();
        if (seasonMetadata) {
          expect(seasonMetadata.episodes).toBeDefined();
          expect(Array.isArray(seasonMetadata.episodes)).toBe(true);
          expect(seasonMetadata.episodes.length).toBeGreaterThan(0);
        }
      }
    }, 20000);
  });

  describe("Geração de Nomes de Arquivo", () => {
    test("Deve gerar nome padronizado para filme", () => {
      const metadata = {
        title: "The Matrix",
        year: 1999,
      };

      const filename = enricher.getMovieFilename(metadata, "1080p");

      expect(filename).toBe("The Matrix (1999) [1080p]");
    });

    test("Deve sanitizar caracteres especiais no nome do filme", () => {
      const metadata = {
        title: "Film: The <Special> Edition",
        year: 2020,
      };

      const filename = enricher.getMovieFilename(metadata);

      expect(filename).not.toContain("<");
      expect(filename).not.toContain(">");
      expect(filename).not.toContain(":");
    });

    test("Deve gerar nome padronizado para episódio", () => {
      const seriesMetadata = {
        name: "Breaking Bad",
      };

      const filename = enricher.getEpisodeFilename(seriesMetadata, 1, 1, "Pilot", "1080p");

      expect(filename).toBe("Breaking Bad - S01E01 - Pilot [1080p]");
    });

    test("Deve gerar nome sem título do episódio", () => {
      const seriesMetadata = {
        name: "Game of Thrones",
      };

      const filename = enricher.getEpisodeFilename(seriesMetadata, 3, 9, null, "720p");

      expect(filename).toBe("Game of Thrones - S03E09 [720p]");
    });

    test("Deve formatar números com zero à esquerda", () => {
      const seriesMetadata = { name: "Test Series" };

      const filename = enricher.getEpisodeFilename(seriesMetadata, 1, 5);

      expect(filename).toContain("S01E05");
    });
  });

  describe("Download de Imagens", () => {
    test("Deve baixar poster se caminho fornecido", async () => {
      // Buscar filme com poster real
      const metadata = await enricher.getMovieMetadata("The Matrix", 1999);

      if (metadata.posterPath && enricher.tmdb) {
        const posterPath = await enricher.downloadPoster(metadata.posterPath, testOutputDir, "test-poster.jpg");

        expect(posterPath).toBeDefined();
        if (posterPath) {
          expect(fs.existsSync(posterPath)).toBe(true);

          // Verificar se thumbnail foi criado
          const thumbPath = path.join(testOutputDir, "test-poster_thumb.jpg");
          expect(fs.existsSync(thumbPath)).toBe(true);

          // Limpar
          fs.unlinkSync(posterPath);
          fs.unlinkSync(thumbPath);
        }
      }
    }, 30000);

    test("Deve retornar null se posterPath for null", async () => {
      const result = await enricher.downloadPoster(null, testOutputDir);
      expect(result).toBeNull();
    });

    test("Deve baixar backdrop/fanart", async () => {
      const metadata = await enricher.getMovieMetadata("Inception", 2010);

      if (metadata.backdropPath && enricher.tmdb) {
        const backdropPath = await enricher.downloadBackdrop(metadata.backdropPath, testOutputDir, "test-fanart.jpg");

        expect(backdropPath).toBeDefined();
        if (backdropPath) {
          expect(fs.existsSync(backdropPath)).toBe(true);

          // Limpar
          fs.unlinkSync(backdropPath);
        }
      }
    }, 30000);
  });

  describe("Geração de NFO", () => {
    test("Deve gerar NFO válido para filme", () => {
      const metadata = {
        title: "Test Movie",
        originalTitle: "Original Test",
        year: 2020,
        overview: "A test movie description",
        runtime: 120,
        rating: 8.5,
        id: 12345,
        imdbId: "tt1234567",
        genres: ["Action", "Drama"],
      };

      const nfoPath = enricher.saveNFO(metadata, testOutputDir, "movie");

      expect(nfoPath).toBeDefined();
      if (nfoPath) {
        expect(fs.existsSync(nfoPath)).toBe(true);

        const content = fs.readFileSync(nfoPath, "utf8");
        expect(content).toContain("<movie>");
        expect(content).toContain("<title>Test Movie</title>");
        expect(content).toContain("<year>2020</year>");
        expect(content).toContain("<rating>8.5</rating>");
        expect(content).toContain("<genre>Action</genre>");

        // Limpar
        fs.unlinkSync(nfoPath);
      }
    });

    test("Deve gerar NFO para série", () => {
      const metadata = {
        name: "Test Series",
        originalName: "Original Test Series",
        overview: "A test series",
        rating: 9.0,
        id: 54321,
        status: "Ended",
        firstAirDate: "2010-01-01",
        genres: ["Comedy", "Drama"],
      };

      const nfoPath = enricher.saveNFO(metadata, testOutputDir, "tvshow");

      expect(nfoPath).toBeDefined();
      if (nfoPath) {
        expect(fs.existsSync(nfoPath)).toBe(true);

        const content = fs.readFileSync(nfoPath, "utf8");
        expect(content).toContain("<tvshow>");
        expect(content).toContain("<title>Test Series</title>");
        expect(content).toContain("<status>Ended</status>");

        // Limpar
        fs.unlinkSync(nfoPath);
      }
    });

    test("Deve gerar NFO para episódio", () => {
      const metadata = {
        name: "Test Episode",
        seasonNumber: 1,
        episodeNumber: 5,
        overview: "Test episode description",
        rating: 8.0,
        airDate: "2020-05-15",
      };

      const nfoPath = enricher.saveNFO(metadata, testOutputDir, "episode");

      expect(nfoPath).toBeDefined();
      if (nfoPath) {
        expect(fs.existsSync(nfoPath)).toBe(true);

        const content = fs.readFileSync(nfoPath, "utf8");
        expect(content).toContain("<episodedetails>");
        expect(content).toContain("<season>1</season>");
        expect(content).toContain("<episode>5</episode>");

        // Limpar
        fs.unlinkSync(nfoPath);
      }
    });

    test("Deve escapar caracteres XML especiais", () => {
      const escaped = enricher.escapeXml('Test & "special" <chars>');

      expect(escaped).toContain("&amp;");
      expect(escaped).toContain("&quot;");
      expect(escaped).toContain("&lt;");
      expect(escaped).toContain("&gt;");
    });
  });

  describe("Utilitários", () => {
    test("Deve sanitizar nomes de arquivo", () => {
      const sanitized = enricher.sanitizeFilename('Test<>:"/\\|?*File');

      expect(sanitized).not.toContain("<");
      expect(sanitized).not.toContain(">");
      expect(sanitized).not.toContain(":");
      expect(sanitized).not.toContain('"');
      expect(sanitized).not.toContain("/");
      expect(sanitized).not.toContain("\\");
      expect(sanitized).not.toContain("|");
      expect(sanitized).not.toContain("?");
      expect(sanitized).not.toContain("*");
    });

    test("Deve remover espaços extras ao sanitizar", () => {
      const sanitized = enricher.sanitizeFilename("  Test   File  ");

      expect(sanitized).toBe("Test File");
    });
  });
});
