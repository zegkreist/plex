/**
 * Testes de integração REAIS para MusicFeedTracker.
 * Fazem chamadas HTTP de verdade — exigem conexão à internet.
 *
 * Executar: npm run test:integration
 *
 * Separados dos testes unitários para que `npm test` continue rápido e offline.
 */

import { describe, test, expect, beforeEach, afterEach } from "@jest/globals";
import MusicFeedTracker from "../src/musicFeedTracker.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testTrackerFile = path.join(__dirname, "test-music-tracker-integration.json");

function cleanup() {
  if (fs.existsSync(testTrackerFile)) fs.unlinkSync(testTrackerFile);
}

// ─── configurações reais ────────────────────────────────────────────────────

const NYAA_LOSSLESS_FEED = {
  name: "Nyaa - Audio Lossless",
  url: "https://nyaa.si/?page=rss&c=2_1",
  enabled: true,
};

const NYAA_LOSSY_FEED = {
  name: "Nyaa - Audio Lossy",
  url: "https://nyaa.si/?page=rss&c=2_2",
  enabled: true,
};

const TPB_FEED = {
  name: "The Pirate Bay - Music",
  url: "https://thepiratebay.org/rss/top100/Music",
  enabled: true,
};

const FEED_404 = {
  name: "Feed Inexistente",
  url: "https://nyaa.si/?page=rss&c=99_99",
  enabled: true,
};

const FEED_WRONG_DOMAIN = {
  name: "Domínio Inválido",
  url: "https://rss.dominio-que-nao-existe-xyz.org/feed",
  enabled: true,
};

function makeConfig(feeds) {
  return {
    music: {
      checkInterval: "0 */12 * * *",
      trackerFile: testTrackerFile,
      feeds,
    },
  };
}

// ─── helpers ────────────────────────────────────────────────────────────────

/** Valida que um item tem os campos mínimos esperados */
function assertValidItem(item) {
  expect(item).toHaveProperty("feedName");
  expect(item).toHaveProperty("title");
  expect(typeof item.title).toBe("string");
  expect(item.title.length).toBeGreaterThan(0);
  expect(item).toHaveProperty("link");
  expect(item).toHaveProperty("guid");
  expect(item).toHaveProperty("magnetLink");
}

// ────────────────────────────────────────────────────────────────────────────

describe("MusicFeedTracker — Integração Real (rede)", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  // ── Nyaa (feed confirmado funcionando) ────────────────────────────────────

  describe("Nyaa RSS", () => {
    test("Deve retornar itens reais do feed Lossless", async () => {
      const tracker = new MusicFeedTracker(makeConfig([NYAA_LOSSLESS_FEED]));

      const items = await tracker.fetchAllFeeds();

      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);
      assertValidItem(items[0]);
      expect(items[0].feedName).toBe("Nyaa - Audio Lossless");
    }, 20000);

    test("Deve retornar itens reais do feed Lossy", async () => {
      const tracker = new MusicFeedTracker(makeConfig([NYAA_LOSSY_FEED]));

      const items = await tracker.fetchAllFeeds();

      expect(items.length).toBeGreaterThan(0);
      assertValidItem(items[0]);
    }, 20000);

    test("Todos os itens de Nyaa devem ter link para .torrent ou página", async () => {
      const tracker = new MusicFeedTracker(makeConfig([NYAA_LOSSLESS_FEED]));

      const items = await tracker.fetchAllFeeds();

      for (const item of items) {
        // Nyaa guid é sempre a URL da página do torrent
        expect(item.guid).toMatch(/^https?:\/\//);
      }
    }, 20000);

    test("Itens de Nyaa devem ter link de download .torrent no enclosure ou link", async () => {
      const tracker = new MusicFeedTracker(makeConfig([NYAA_LOSSLESS_FEED]));
      const items = await tracker.fetchAllFeeds();

      // Nyaa usa link direto para .torrent, não magnet
      const firstWithLink = items.find((i) => i.link);
      expect(firstWithLink).toBeDefined();
      expect(firstWithLink.link).toMatch(/nyaa\.si/);
    }, 20000);

    test("Múltiplos feeds simultâneos devem retornar itens de ambos", async () => {
      const tracker = new MusicFeedTracker(makeConfig([NYAA_LOSSLESS_FEED, NYAA_LOSSY_FEED]));

      const items = await tracker.fetchAllFeeds();

      const feedNames = new Set(items.map((i) => i.feedName));
      expect(feedNames.has("Nyaa - Audio Lossless")).toBe(true);
      expect(feedNames.has("Nyaa - Audio Lossy")).toBe(true);
    }, 30000);

    test("searchInFeeds deve filtrar resultados reais por artista", async () => {
      // Artistas com presença frequente no Nyaa (anime/game music)
      const tracker = new MusicFeedTracker(makeConfig([NYAA_LOSSLESS_FEED]));

      // Buscar por "FLAC" que aparece em praticamente todos os títulos do Nyaa lossless
      const results = await tracker.searchInFeeds("FLAC");

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]._fromRSS).toBe(true);
      expect(results[0].title.toLowerCase()).toContain("flac");
    }, 20000);

    test("searchInFeeds com artista inexistente deve retornar array vazio", async () => {
      const tracker = new MusicFeedTracker(makeConfig([NYAA_LOSSLESS_FEED]));

      const results = await tracker.searchInFeeds("ArtistaTotalmenteInexistenteXYZ999");

      expect(results).toEqual([]);
    }, 20000);

    test("seenItems deve evitar duplicatas entre duas chamadas consecutivas", async () => {
      const tracker = new MusicFeedTracker(makeConfig([NYAA_LOSSLESS_FEED]));

      const firstBatch = await tracker.fetchAllFeeds();
      expect(firstBatch.length).toBeGreaterThan(0);

      // Segunda chamada — os mesmos itens já estão em seenItems
      const secondBatch = await tracker.fetchAllFeeds();
      expect(secondBatch.length).toBe(0);
    }, 40000);
  });

  // ── The Pirate Bay ────────────────────────────────────────────────────────

  describe("The Pirate Bay RSS", () => {
    test("Deve retornar itens ou falhar graciosamente (sem lançar exceção)", async () => {
      const tracker = new MusicFeedTracker(makeConfig([TPB_FEED]));

      // TPB pode estar inacessível — o importante é não explodir
      await expect(tracker.fetchAllFeeds()).resolves.toBeDefined();
    }, 20000);

    test("Se retornar itens, devem ter estrutura válida", async () => {
      const tracker = new MusicFeedTracker(makeConfig([TPB_FEED]));
      const items = await tracker.fetchAllFeeds();

      for (const item of items) {
        assertValidItem(item);
      }
    }, 20000);
  });

  // ── Resiliência a falhas ──────────────────────────────────────────────────

  describe("Resiliência a erros de rede reais", () => {
    test("ENOTFOUND: domínio inexistente não deve lançar exceção", async () => {
      const tracker = new MusicFeedTracker(makeConfig([FEED_WRONG_DOMAIN]));

      const items = await tracker.fetchAllFeeds();

      // Deve retornar array vazio, não explodir
      expect(Array.isArray(items)).toBe(true);
      expect(items).toHaveLength(0);
    }, 20000);

    test("Feed inválido não deve impedir feeds válidos de serem lidos", async () => {
      const tracker = new MusicFeedTracker(makeConfig([FEED_WRONG_DOMAIN, NYAA_LOSSLESS_FEED]));

      const items = await tracker.fetchAllFeeds();

      // Nyaa deve ter retornado itens mesmo com o primeiro feed falhando
      expect(items.length).toBeGreaterThan(0);
      expect(items[0].feedName).toBe("Nyaa - Audio Lossless");
    }, 30000);

    test("Feed desabilitado nunca deve ser consultado", async () => {
      const tracker = new MusicFeedTracker(makeConfig([{ ...FEED_WRONG_DOMAIN, enabled: false }, NYAA_LOSSLESS_FEED]));

      const items = await tracker.fetchAllFeeds();

      // Só Nyaa foi consultado — itens presentes e sem erro de ENOTFOUND
      expect(items.length).toBeGreaterThan(0);
    }, 20000);
  });

  // ── buildFeedUrl ──────────────────────────────────────────────────────────

  describe("buildFeedUrl (lógica de URL, sem rede)", () => {
    let tracker;
    beforeEach(() => {
      tracker = new MusicFeedTracker(makeConfig([]));
    });

    test("URL simples sem auth ou queryParams não é alterada", () => {
      const feed = { url: "https://nyaa.si/?page=rss&c=2_1" };
      expect(tracker.buildFeedUrl(feed)).toBe("https://nyaa.si/?page=rss&c=2_1");
    });

    test("Deve injetar username e password na URL (estilo TMB)", () => {
      const feed = {
        url: "https://themixingbowl.org/rssddl.xml",
        username: "myuser",
        password: "mypass",
      };
      const result = tracker.buildFeedUrl(feed);
      expect(result).toContain("myuser");
      expect(result).toContain("mypass");
      expect(result).toContain("themixingbowl.org");
    });

    test("Deve codificar credenciais com caracteres especiais", () => {
      const feed = {
        url: "https://themixingbowl.org/rssddl.xml",
        username: "user@mail.com",
        password: "p@ss#word!",
      };
      const result = tracker.buildFeedUrl(feed);
      // URL.username getter retorna valor percent-encoded; decodificar para comparar
      const url = new URL(result);
      expect(decodeURIComponent(url.username)).toBe("user@mail.com");
      expect(decodeURIComponent(url.password)).toBe("p@ss#word!");
    });

    test("Deve adicionar queryParams ao URL (filtros TMB)", () => {
      const feed = {
        url: "https://themixingbowl.org/rssddl.xml",
        username: "user",
        password: "pass",
        queryParams: { search: "artist:4hero, year:2010" },
      };
      const result = tracker.buildFeedUrl(feed);
      expect(result).toContain("search=");
      expect(result).toContain("4hero");
    });

    test("queryParams vazios não devem ser adicionados à URL", () => {
      const feed = {
        url: "https://themixingbowl.org/rssddl.xml",
        queryParams: { tag: "", artist: null, year: undefined },
      };
      const result = tracker.buildFeedUrl(feed);
      expect(result).not.toContain("tag=");
      expect(result).not.toContain("artist=");
      expect(result).not.toContain("year=");
    });

    test("Feed sem username/password não deve ter @ na URL", () => {
      const feed = { url: "https://nyaa.si/?page=rss" };
      const result = tracker.buildFeedUrl(feed);
      expect(result).not.toContain("@");
    });
  });
});
