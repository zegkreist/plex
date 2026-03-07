import { describe, test, expect, beforeAll } from "@jest/globals";
import torrentSearch from "../src/torrentSearch.js";

describe("TorrentSearch - Testes de Integração", () => {
  beforeAll(async () => {
    // Inicializar o módulo de busca
    await torrentSearch.initialize();
  });

  describe("Busca de Filmes", () => {
    test("Deve buscar torrents de um filme popular", async () => {
      const results = await torrentSearch.searchMovies("The Matrix", 1999);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      // Verificar estrutura do resultado
      const firstResult = results[0];
      expect(firstResult).toHaveProperty("title");
      expect(firstResult).toHaveProperty("seeds");
      expect(firstResult).toHaveProperty("size");
      expect(firstResult).toHaveProperty("score");

      // O melhor resultado deve ter score alto
      expect(firstResult.score).toBeGreaterThan(0);
    }, 30000);

    test("Deve buscar filme sem ano especificado", async () => {
      const results = await torrentSearch.searchMovies("Inception");

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
    }, 30000);

    test("Deve retornar array vazio para filme inexistente", async () => {
      const results = await torrentSearch.searchMovies("FilmeQueNaoExiste123456789XYZ");

      expect(Array.isArray(results)).toBe(true);
      // Pode retornar vazio ou com poucos resultados
      expect(results.length).toBeLessThan(5);
    }, 30000);
  });

  describe("Busca de Séries", () => {
    test("Deve buscar episódio específico de série", async () => {
      const results = await torrentSearch.searchSeries("Breaking Bad", 1, 1);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      // Verificar se contém S01E01
      const firstResult = results[0];
      expect(firstResult.title.toLowerCase()).toMatch(/s01e01|season.*1.*episode.*1/i);
    }, 30000);

    test("Deve buscar temporada inteira", async () => {
      const results = await torrentSearch.searchSeries("Game of Thrones", 1, null);

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);

      // Deve mencionar season 1 ou S01
      const firstResult = results[0];
      expect(firstResult.title.toLowerCase()).toMatch(/season.*1|s01/i);
    }, 30000);

    test("Deve buscar série sem season/episode específico", async () => {
      const results = await torrentSearch.searchSeries("The Office");

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe("Busca de Música", () => {
    test("Deve buscar música por artista e álbum", async () => {
      const results = await torrentSearch.searchMusic("Pink Floyd", "Dark Side of the Moon");

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      const firstResult = results[0];
      expect(firstResult.title.toLowerCase()).toMatch(/pink floyd|dark side/i);
    }, 30000);

    test("Deve buscar música apenas por artista", async () => {
      const results = await torrentSearch.searchMusic("The Beatles");

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe("Sistema de Ranqueamento", () => {
    test("Resultados devem estar ordenados por score", async () => {
      const results = await torrentSearch.searchMovies("Avengers", 2012);

      expect(results.length).toBeGreaterThan(1);

      // Verificar ordem decrescente de score
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
      }
    }, 30000);

    test("Deve calcular score baseado em seeders, tamanho e qualidade", async () => {
      const results = await torrentSearch.searchMovies("Interstellar", 2014);

      expect(results.length).toBeGreaterThan(0);

      const topResult = results[0];
      expect(topResult.score).toBeGreaterThan(0);
      expect(topResult.seeders).toBeDefined();

      // Torrents de melhor qualidade tendem a ter scores maiores
      const has1080p = topResult.title.toLowerCase().includes("1080p");
      const has720p = topResult.title.toLowerCase().includes("720p");

      if (has1080p || has720p) {
        expect(topResult.score).toBeGreaterThan(20);
      }
    }, 30000);
  });

  describe("Magnet Links", () => {
    test("Deve obter magnet link válido", async () => {
      const results = await torrentSearch.searchMovies("Big Buck Bunny");

      expect(results.length).toBeGreaterThan(0);

      const magnetLink = await torrentSearch.getMagnetLink(results[0]);

      expect(magnetLink).toBeDefined();
      if (magnetLink) {
        expect(magnetLink).toMatch(/^magnet:\?xt=urn:btih:/);
      }
    }, 30000);
  });

  describe("Busca Genérica", () => {
    test("Deve realizar busca genérica", async () => {
      const results = await torrentSearch.search("Ubuntu", "All", 5);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    }, 30000);
  });

  describe("Tratamento de Erros", () => {
    test("Deve lidar com busca vazia", async () => {
      const results = await torrentSearch.searchMovies("");

      expect(Array.isArray(results)).toBe(true);
    }, 30000);

    test("Deve lidar com caracteres especiais", async () => {
      const results = await torrentSearch.searchMovies("Amélie");

      expect(Array.isArray(results)).toBe(true);
    }, 30000);
  });

  describe("Utilitários", () => {
    test("Deve converter tamanho para MB corretamente", () => {
      expect(torrentSearch.parseSizeToMB("1.5 GB")).toBeCloseTo(1536, 0);
      expect(torrentSearch.parseSizeToMB("500 MB")).toBeCloseTo(500, 0);
      expect(torrentSearch.parseSizeToMB("2048 KB")).toBeCloseTo(2, 0);
    });

    test("Deve calcular score de qualidade", () => {
      const score1080p = torrentSearch.calculateQualityScore("Movie 1080p x265");
      const score720p = torrentSearch.calculateQualityScore("Movie 720p");
      const score480p = torrentSearch.calculateQualityScore("Movie 480p");

      expect(score1080p).toBeGreaterThan(score720p);
      expect(score720p).toBeGreaterThan(score480p);
    });
  });
});
