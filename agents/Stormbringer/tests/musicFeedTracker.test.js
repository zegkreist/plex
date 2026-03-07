import { describe, test, expect, beforeEach, afterEach, jest } from "@jest/globals";
import MusicFeedTracker from "../src/musicFeedTracker.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── helpers ────────────────────────────────────────────────────────────────

const testTrackerFile = path.join(__dirname, "test-music-tracker.json");

/** Constrói configuração de teste com feeds mock opcionais */
function makeConfig(feeds = []) {
  return {
    music: {
      checkInterval: "0 */12 * * *",
      trackerFile: testTrackerFile,
      feeds,
    },
  };
}

/** Cria um item RSS fake */
function rssItem({ title, guid, link = "", enclosure = null, pubDate = null } = {}) {
  return { title, guid: guid || title, link, enclosure, pubDate };
}

/** Cria um parser mockado que resolve com os itens fornecidos */
function mockParser(feedItems = []) {
  return {
    parseURL: jest.fn().mockResolvedValue({ items: feedItems }),
  };
}

// ─── setup / teardown ────────────────────────────────────────────────────────

function cleanup() {
  if (fs.existsSync(testTrackerFile)) fs.unlinkSync(testTrackerFile);
}

// ─── testes ──────────────────────────────────────────────────────────────────

describe("MusicFeedTracker", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  // ───────────────────────────────────────────────────────────
  //  Persistência
  // ───────────────────────────────────────────────────────────

  describe("Persistência", () => {
    test("Deve iniciar com lista de artistas vazia quando não há arquivo", () => {
      const tracker = new MusicFeedTracker(makeConfig());
      expect(tracker.listArtists()).toEqual([]);
    });

    test("Deve salvar e recarregar artistas do arquivo", () => {
      const tracker = new MusicFeedTracker(makeConfig());
      tracker.addArtist("Pink Floyd", "Rock");

      // Nova instância lendo o mesmo arquivo
      const tracker2 = new MusicFeedTracker(makeConfig());
      const artists = tracker2.listArtists();

      expect(artists).toHaveLength(1);
      expect(artists[0].name).toBe("Pink Floyd");
      expect(artists[0].genre).toBe("Rock");
    });

    test("Deve salvar e recarregar seenItems do arquivo", () => {
      const config = makeConfig([{ name: "Feed A", url: "http://fake.feed/rss", enabled: true }]);
      const parser = mockParser([rssItem({ title: "Artist - Album (2024)", guid: "uid-1" })]);
      const tracker = new MusicFeedTracker(config, { parser });

      // checkForNewReleases marca os itens como vistos
      tracker.addArtist("Artist");
      return tracker.checkForNewReleases().then(() => {
        const tracker2 = new MusicFeedTracker(config, { parser: mockParser([]) });
        expect(tracker2.seenItems.has("uid-1")).toBe(true);
      });
    });

    test("Deve lidar com arquivo corrompido sem lançar exceção", () => {
      fs.writeFileSync(testTrackerFile, "{ invalid json }");
      expect(() => new MusicFeedTracker(makeConfig())).not.toThrow();
    });
  });

  // ───────────────────────────────────────────────────────────
  //  Gerenciamento de artistas
  // ───────────────────────────────────────────────────────────

  describe("Gerenciamento de Artistas", () => {
    test("Deve adicionar artista com campos corretos", () => {
      const tracker = new MusicFeedTracker(makeConfig());
      const artist = tracker.addArtist("The Beatles", "Pop");

      expect(artist).not.toBeNull();
      expect(artist.name).toBe("The Beatles");
      expect(artist.genre).toBe("Pop");
      expect(artist.active).toBe(true);
      expect(artist.id).toBeDefined();
      expect(artist.addedAt).toBeDefined();
      expect(artist.lastChecked).toBeNull();
    });

    test("Deve adicionar artista sem gênero", () => {
      const tracker = new MusicFeedTracker(makeConfig());
      const artist = tracker.addArtist("Radiohead");

      expect(artist.genre).toBeNull();
    });

    test("Deve rejeitar artista duplicado (case-insensitive)", () => {
      const tracker = new MusicFeedTracker(makeConfig());
      tracker.addArtist("Pink Floyd");
      const duplicate = tracker.addArtist("pink floyd");

      expect(duplicate).toBeNull();
      expect(tracker.listArtists()).toHaveLength(1);
    });

    test("Deve adicionar múltiplos artistas", () => {
      const tracker = new MusicFeedTracker(makeConfig());
      tracker.addArtist("Artist A");
      tracker.addArtist("Artist B");
      tracker.addArtist("Artist C");

      expect(tracker.listArtists()).toHaveLength(3);
    });

    test("Deve remover artista pelo id", () => {
      const tracker = new MusicFeedTracker(makeConfig());
      const artist = tracker.addArtist("Artist X");

      const removed = tracker.removeArtist(artist.id);

      expect(removed).toBe(true);
      expect(tracker.listArtists()).toHaveLength(0);
    });

    test("Deve retornar false ao remover id inexistente", () => {
      const tracker = new MusicFeedTracker(makeConfig());
      expect(tracker.removeArtist("id-inexistente")).toBe(false);
    });

    test("Deve persistir remoção no arquivo", () => {
      const tracker = new MusicFeedTracker(makeConfig());
      const a = tracker.addArtist("Temporário");
      tracker.removeArtist(a.id);

      const tracker2 = new MusicFeedTracker(makeConfig());
      expect(tracker2.listArtists()).toHaveLength(0);
    });
  });

  // ───────────────────────────────────────────────────────────
  //  extractMagnet
  // ───────────────────────────────────────────────────────────

  describe("extractMagnet", () => {
    let tracker;
    beforeEach(() => {
      tracker = new MusicFeedTracker(makeConfig());
    });

    test("Deve extrair magnet do enclosure.url", () => {
      const item = rssItem({ title: "t", enclosure: { url: "magnet:?xt=urn:btih:abc123&dn=Test" } });
      expect(tracker.extractMagnet(item)).toBe("magnet:?xt=urn:btih:abc123&dn=Test");
    });

    test("Deve extrair magnet do link quando começa com magnet:", () => {
      const item = rssItem({ title: "t", link: "magnet:?xt=urn:btih:def456" });
      expect(tracker.extractMagnet(item)).toBe("magnet:?xt=urn:btih:def456");
    });

    test("Deve extrair magnet de campo embutido no JSON do item", () => {
      const item = {
        title: "t",
        link: "https://site.com/torrent",
        "torrent:magnetURI": "magnet:?xt=urn:btih:ghi789",
      };
      expect(tracker.extractMagnet(item)).toBe("magnet:?xt=urn:btih:ghi789");
    });

    test("Deve retornar null quando não há magnet", () => {
      const item = rssItem({ title: "t", link: "https://site.com/page" });
      expect(tracker.extractMagnet(item)).toBeNull();
    });

    test("Deve preferir enclosure.url ao link", () => {
      const item = {
        title: "t",
        link: "magnet:?xt=urn:btih:linkmagnet",
        enclosure: { url: "magnet:?xt=urn:btih:enclosuremagnet" },
      };
      expect(tracker.extractMagnet(item)).toBe("magnet:?xt=urn:btih:enclosuremagnet");
    });

    test("Deve ignorar enclosure.url que não é magnet", () => {
      const item = rssItem({
        title: "t",
        link: "magnet:?xt=urn:btih:linkmagnet",
        enclosure: { url: "https://cdn.site.com/file.torrent" },
      });
      expect(tracker.extractMagnet(item)).toBe("magnet:?xt=urn:btih:linkmagnet");
    });
  });

  // ───────────────────────────────────────────────────────────
  //  fetchAllFeeds
  // ───────────────────────────────────────────────────────────

  describe("fetchAllFeeds", () => {
    test("Deve retornar array vazio sem feeds habilitados", async () => {
      const tracker = new MusicFeedTracker(makeConfig());
      const items = await tracker.fetchAllFeeds();
      expect(items).toEqual([]);
    });

    test("Deve retornar itens dos feeds habilitados", async () => {
      const config = makeConfig([{ name: "Feed A", url: "http://fake/rss", enabled: true }]);
      const feedItems = [rssItem({ title: "Pink Floyd - Wish You Were Here FLAC", guid: "1" }), rssItem({ title: "Radiohead - OK Computer 320kbps", guid: "2" })];
      const tracker = new MusicFeedTracker(config, { parser: mockParser(feedItems) });

      const items = await tracker.fetchAllFeeds();

      expect(items).toHaveLength(2);
      expect(items[0].title).toBe("Pink Floyd - Wish You Were Here FLAC");
      expect(items[0].feedName).toBe("Feed A");
      expect(items[1].guid).toBe("2");
    });

    test("Deve ignorar feeds desabilitados", async () => {
      const config = makeConfig([
        { name: "Ativo", url: "http://fake/rss1", enabled: true },
        { name: "Inativo", url: "http://fake/rss2", enabled: false },
      ]);
      const parser = {
        parseURL: jest.fn().mockResolvedValue({ items: [rssItem({ title: "Item do ativo", guid: "x" })] }),
      };
      const tracker = new MusicFeedTracker(config, { parser });

      await tracker.fetchAllFeeds();

      // parseURL só deve ser chamado para o feed ativo
      expect(parser.parseURL).toHaveBeenCalledTimes(1);
      expect(parser.parseURL).toHaveBeenCalledWith("http://fake/rss1");
    });

    test("Não deve retornar itens já vistos (seenItems)", async () => {
      const config = makeConfig([{ name: "F", url: "http://f/rss", enabled: true }]);
      const feedItems = [rssItem({ title: "Visto", guid: "seen-guid" })];
      const tracker = new MusicFeedTracker(config, { parser: mockParser(feedItems) });

      tracker.seenItems.add("seen-guid");
      const items = await tracker.fetchAllFeeds();

      expect(items).toHaveLength(0);
    });

    test("Deve continuar se um feed lançar erro", async () => {
      const config = makeConfig([
        { name: "Com erro", url: "http://broken/rss", enabled: true },
        { name: "OK", url: "http://ok/rss", enabled: true },
      ]);
      const parser = {
        parseURL: jest
          .fn()
          .mockRejectedValueOnce(new Error("timeout"))
          .mockResolvedValueOnce({ items: [rssItem({ title: "Item OK", guid: "ok-1" })] }),
      };
      const tracker = new MusicFeedTracker(config, { parser });

      const items = await tracker.fetchAllFeeds();

      expect(items).toHaveLength(1);
      expect(items[0].title).toBe("Item OK");
    });

    test("Deve mapear magnetLink, link e feedName corretamente", async () => {
      const config = makeConfig([{ name: "TPB", url: "http://tpb/rss", enabled: true }]);
      const feedItems = [
        {
          title: "Artist Album",
          guid: "g1",
          link: "https://tpb.com/torrent/123",
          "torrent:magnetURI": "magnet:?xt=urn:btih:123abc",
          pubDate: "2024-01-01",
        },
      ];
      const tracker = new MusicFeedTracker(config, { parser: mockParser(feedItems) });

      const items = await tracker.fetchAllFeeds();

      expect(items[0].magnetLink).toBe("magnet:?xt=urn:btih:123abc");
      expect(items[0].link).toBe("https://tpb.com/torrent/123");
      expect(items[0].feedName).toBe("TPB");
    });
  });

  // ───────────────────────────────────────────────────────────
  //  searchInFeeds
  // ───────────────────────────────────────────────────────────

  describe("searchInFeeds", () => {
    function makeTrackerWithItems(items) {
      const config = makeConfig([{ name: "F", url: "http://f/rss", enabled: true }]);
      return new MusicFeedTracker(config, { parser: mockParser(items) });
    }

    test("Deve retornar resultados que contêm artista no título", async () => {
      const tracker = makeTrackerWithItems([rssItem({ title: "Pink Floyd - Animals FLAC", guid: "1" }), rssItem({ title: "Radiohead - Pablo Honey 320", guid: "2" })]);

      const results = await tracker.searchInFeeds("Pink Floyd");

      expect(results).toHaveLength(1);
      expect(results[0].title).toMatch(/Pink Floyd/i);
    });

    test("Deve filtrar por artista e álbum juntos", async () => {
      const tracker = makeTrackerWithItems([rssItem({ title: "Pink Floyd - The Wall FLAC", guid: "1" }), rssItem({ title: "Pink Floyd - Animals 320kbps", guid: "2" }), rssItem({ title: "Led Zeppelin - IV FLAC", guid: "3" })]);

      const results = await tracker.searchInFeeds("Pink Floyd", "The Wall");

      expect(results).toHaveLength(1);
      expect(results[0].title).toMatch(/The Wall/i);
    });

    test("Deve ser case-insensitive", async () => {
      const tracker = makeTrackerWithItems([rssItem({ title: "PINK FLOYD - DARK SIDE OF THE MOON", guid: "1" })]);

      const results = await tracker.searchInFeeds("pink floyd", "dark side");
      expect(results).toHaveLength(1);
    });

    test("Deve retornar array vazio quando não há resultados", async () => {
      const tracker = makeTrackerWithItems([rssItem({ title: "Totally Different Artist - Album", guid: "1" })]);

      const results = await tracker.searchInFeeds("Metallica");
      expect(results).toEqual([]);
    });

    test("Deve normalizar resultados para o formato de torrentSearch", async () => {
      const tracker = makeTrackerWithItems([{ title: "Artist - Album", guid: "1", link: "https://site.com/t", enclosure: null, pubDate: null }]);

      const results = await tracker.searchInFeeds("Artist");

      expect(results[0]).toMatchObject({
        title: "Artist - Album",
        seeds: 0,
        size: "Desconhecido",
        score: 50,
        _fromRSS: true,
        provider: "F",
      });
    });

    test("Deve retornar magnetLink se existir no item RSS", async () => {
      const item = {
        title: "Band - Record",
        guid: "g1",
        link: "https://site.com/t",
        enclosure: { url: "magnet:?xt=urn:btih:aabbcc" },
        pubDate: null,
      };
      const config = makeConfig([{ name: "Feed", url: "http://f/rss", enabled: true }]);
      const tracker = new MusicFeedTracker(config, { parser: mockParser([item]) });

      const results = await tracker.searchInFeeds("Band");

      expect(results[0].magnetLink).toBe("magnet:?xt=urn:btih:aabbcc");
    });
  });

  // ───────────────────────────────────────────────────────────
  //  checkForNewReleases
  // ───────────────────────────────────────────────────────────

  describe("checkForNewReleases", () => {
    test("Deve retornar array vazio sem artistas monitorados", async () => {
      const config = makeConfig([{ name: "F", url: "http://f/rss", enabled: true }]);
      const tracker = new MusicFeedTracker(config, {
        parser: mockParser([rssItem({ title: "Some Artist - Album", guid: "1" })]),
      });

      const releases = await tracker.checkForNewReleases();
      expect(releases).toEqual([]);
    });

    test("Deve encontrar lançamento correspondente ao artista monitorado", async () => {
      const config = makeConfig([{ name: "F", url: "http://f/rss", enabled: true }]);
      const tracker = new MusicFeedTracker(config, {
        parser: mockParser([rssItem({ title: "Pink Floyd - Pulse FLAC", guid: "1" }), rssItem({ title: "Radiohead - OK Computer", guid: "2" })]),
      });
      tracker.addArtist("Pink Floyd");

      const releases = await tracker.checkForNewReleases();

      expect(releases).toHaveLength(1);
      expect(releases[0].artist.name).toBe("Pink Floyd");
      expect(releases[0].item.title).toBe("Pink Floyd - Pulse FLAC");
    });

    test("Deve encontrar lançamentos de múltiplos artistas", async () => {
      const config = makeConfig([{ name: "F", url: "http://f/rss", enabled: true }]);
      const tracker = new MusicFeedTracker(config, {
        parser: mockParser([rssItem({ title: "Pink Floyd - Wish You Were Here", guid: "1" }), rssItem({ title: "Radiohead - The Bends 320", guid: "2" }), rssItem({ title: "Unrelated Album", guid: "3" })]),
      });
      tracker.addArtist("Pink Floyd");
      tracker.addArtist("Radiohead");

      const releases = await tracker.checkForNewReleases();

      expect(releases).toHaveLength(2);
      const names = releases.map((r) => r.artist.name);
      expect(names).toContain("Pink Floyd");
      expect(names).toContain("Radiohead");
    });

    test("Deve marcar todos os itens como vistos após checagem", async () => {
      const config = makeConfig([{ name: "F", url: "http://f/rss", enabled: true }]);
      const tracker = new MusicFeedTracker(config, {
        parser: mockParser([rssItem({ title: "Artist A - Album 1", guid: "guid-a" }), rssItem({ title: "Artist B - Album 2", guid: "guid-b" })]),
      });
      tracker.addArtist("Artist A");

      await tracker.checkForNewReleases();

      expect(tracker.seenItems.has("guid-a")).toBe(true);
      expect(tracker.seenItems.has("guid-b")).toBe(true);
    });

    test("Não deve retornar itens já vistos em checagem subsequente", async () => {
      const config = makeConfig([{ name: "F", url: "http://f/rss", enabled: true }]);
      const items = [rssItem({ title: "Pink Floyd - Animals", guid: "seen-1" })];
      const tracker = new MusicFeedTracker(config, { parser: mockParser(items) });
      tracker.addArtist("Pink Floyd");

      // Primeira checagem: marca como visto
      await tracker.checkForNewReleases();

      // Segunda checagem com mesmos itens: nada novo
      const releases2 = await tracker.checkForNewReleases();
      expect(releases2).toHaveLength(0);
    });

    test("Deve ignorar artistas inativos", async () => {
      const config = makeConfig([{ name: "F", url: "http://f/rss", enabled: true }]);
      const tracker = new MusicFeedTracker(config, {
        parser: mockParser([rssItem({ title: "Pink Floyd - Meddle", guid: "1" })]),
      });
      const artist = tracker.addArtist("Pink Floyd");
      artist.active = false;
      tracker.save();

      const releases = await tracker.checkForNewReleases();
      expect(releases).toHaveLength(0);
    });

    test("Deve atualizar lastChecked dos artistas ativos", async () => {
      const config = makeConfig([{ name: "F", url: "http://f/rss", enabled: true }]);
      const tracker = new MusicFeedTracker(config, { parser: mockParser([]) });
      tracker.addArtist("Any Artist");

      await tracker.checkForNewReleases();

      const artists = tracker.listArtists();
      expect(artists[0].lastChecked).not.toBeNull();
    });
  });

  // ───────────────────────────────────────────────────────────
  //  browseFeeds
  // ───────────────────────────────────────────────────────────

  describe("browseFeeds", () => {
    test("Deve retornar os últimos N itens", async () => {
      const config = makeConfig([{ name: "F", url: "http://f/rss", enabled: true }]);
      const items = Array.from({ length: 50 }, (_, i) => rssItem({ title: `Item ${i}`, guid: `g${i}` }));
      const tracker = new MusicFeedTracker(config, { parser: mockParser(items) });

      const result = await tracker.browseFeeds(10);
      expect(result).toHaveLength(10);
    });

    test("Deve retornar todos os itens se limit > total", async () => {
      const config = makeConfig([{ name: "F", url: "http://f/rss", enabled: true }]);
      const tracker = new MusicFeedTracker(config, {
        parser: mockParser([rssItem({ title: "A", guid: "1" }), rssItem({ title: "B", guid: "2" })]),
      });

      const result = await tracker.browseFeeds(100);
      expect(result).toHaveLength(2);
    });
  });

  // ───────────────────────────────────────────────────────────
  //  Gerenciamento de Feeds
  // ───────────────────────────────────────────────────────────

  describe("Gerenciamento de Feeds", () => {
    test("Deve listar feeds configurados", () => {
      const feeds = [
        { name: "Feed A", url: "http://a/rss", enabled: true },
        { name: "Feed B", url: "http://b/rss", enabled: false },
      ];
      const tracker = new MusicFeedTracker(makeConfig(feeds));

      expect(tracker.listFeeds()).toHaveLength(2);
      expect(tracker.listFeeds()[0].name).toBe("Feed A");
    });

    test("Deve habilitar feed pelo nome", () => {
      const feeds = [{ name: "Feed A", url: "http://a/rss", enabled: false }];
      const tracker = new MusicFeedTracker(makeConfig(feeds));

      const result = tracker.enableFeed("Feed A");

      expect(result).toBe(true);
      expect(tracker.listFeeds()[0].enabled).toBe(true);
    });

    test("Deve desabilitar feed pelo nome", () => {
      const feeds = [{ name: "Feed A", url: "http://a/rss", enabled: true }];
      const tracker = new MusicFeedTracker(makeConfig(feeds));

      const result = tracker.disableFeed("Feed A");

      expect(result).toBe(true);
      expect(tracker.listFeeds()[0].enabled).toBe(false);
    });

    test("Deve retornar false para feed inexistente", () => {
      const tracker = new MusicFeedTracker(makeConfig([]));

      expect(tracker.enableFeed("Não Existe")).toBe(false);
      expect(tracker.disableFeed("Não Existe")).toBe(false);
    });

    test("Deve retornar array vazio quando não há feeds", () => {
      const tracker = new MusicFeedTracker(makeConfig());
      expect(tracker.listFeeds()).toEqual([]);
    });
  });

  // ───────────────────────────────────────────────────────────
  //  Scheduler
  // ───────────────────────────────────────────────────────────

  describe("Scheduler", () => {
    test("Deve iniciar e parar o scheduler", () => {
      const tracker = new MusicFeedTracker(makeConfig());

      tracker.startScheduler(() => {});
      expect(tracker.cronJob).not.toBeNull();

      tracker.stopScheduler();
      expect(tracker.cronJob).toBeNull();
    });

    test("Não deve iniciar scheduler duplicado", () => {
      const tracker = new MusicFeedTracker(makeConfig());

      tracker.startScheduler(() => {});
      const firstJob = tracker.cronJob;

      tracker.startScheduler(() => {});
      expect(tracker.cronJob).toBe(firstJob);

      tracker.stopScheduler();
    });

    test("stopScheduler sem cronJob não deve lançar exceção", () => {
      const tracker = new MusicFeedTracker(makeConfig());
      expect(() => tracker.stopScheduler()).not.toThrow();
    });
  });

  // ───────────────────────────────────────────────────────────
  //  buildFeedUrl
  // ───────────────────────────────────────────────────────────

  describe("buildFeedUrl", () => {
    let tracker;
    beforeEach(() => {
      tracker = new MusicFeedTracker(makeConfig());
    });

    test("URL sem auth ou queryParams não é modificada", () => {
      expect(tracker.buildFeedUrl({ url: "https://nyaa.si/?page=rss&c=2_1" })).toBe("https://nyaa.si/?page=rss&c=2_1");
    });

    test("Injeta username e password na URL", () => {
      const result = tracker.buildFeedUrl({
        url: "https://themixingbowl.org/rssddl.xml",
        username: "myuser",
        password: "mypass",
      });
      expect(result).toContain("myuser");
      expect(result).toContain("mypass");
      expect(result).toContain("themixingbowl.org");
    });

    test("Codifica credenciais com caracteres especiais", () => {
      const result = tracker.buildFeedUrl({
        url: "https://themixingbowl.org/rssddl.xml",
        username: "user@mail.com",
        password: "p@ss!",
      });
      const parsed = new URL(result);
      expect(decodeURIComponent(parsed.username)).toBe("user@mail.com");
      expect(decodeURIComponent(parsed.password)).toBe("p@ss!");
    });

    test("Adiciona queryParams ao URL", () => {
      const result = tracker.buildFeedUrl({
        url: "https://themixingbowl.org/rssddl.xml",
        username: "u",
        password: "p",
        queryParams: { search: "artist:4hero, year:2010" },
      });
      expect(result).toContain("search=");
      expect(result).toContain("4hero");
    });

    test("Não adiciona queryParams vazios/nulos", () => {
      const result = tracker.buildFeedUrl({
        url: "https://site.org/rss",
        queryParams: { tag: "", artist: null, year: undefined },
      });
      expect(result).not.toContain("tag=");
      expect(result).not.toContain("artist=");
      expect(result).not.toContain("year=");
    });

    test("Feed sem credenciais não tem @ na URL", () => {
      const result = tracker.buildFeedUrl({ url: "https://nyaa.si/?page=rss" });
      expect(result).not.toContain("@");
    });
  });
});
