import fs from "fs";
import path from "path";
import axios from "axios";
import cron from "node-cron";
import Parser from "rss-parser";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MusicFeedTracker {
  /**
   * @param {object} config  - Configuração principal (config.json)
   * @param {object} [opts]
   * @param {object} [opts.parser] - Instância do rss-parser (injetável para testes)
   */
  constructor(config, { parser } = {}) {
    this.config = config;
    this.trackerFile = config.music?.trackerFile || "./music_tracker.json";
    this.feeds = config.music?.feeds || [];
    this.trackedArtists = this.loadTrackedArtists();
    this.seenItems = this.loadSeenItems();
    this.cronJob = null;
    this.parser =
      parser ||
      new Parser({
        timeout: 10000,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; TorrentManager/1.0)",
        },
      });
  }

  // ─────────────────────────────────────────
  //  Persistência
  // ─────────────────────────────────────────

  loadTrackedArtists() {
    try {
      if (fs.existsSync(this.trackerFile)) {
        const data = JSON.parse(fs.readFileSync(this.trackerFile, "utf8"));
        return data.artists || [];
      }
    } catch (err) {
      console.error("Erro ao carregar music_tracker.json:", err.message);
    }
    return [];
  }

  loadSeenItems() {
    try {
      if (fs.existsSync(this.trackerFile)) {
        const data = JSON.parse(fs.readFileSync(this.trackerFile, "utf8"));
        return new Set(data.seenItems || []);
      }
    } catch (err) {
      // silencioso
    }
    return new Set();
  }

  save() {
    try {
      const data = {
        artists: this.trackedArtists,
        seenItems: Array.from(this.seenItems),
        lastUpdate: new Date().toISOString(),
      };
      fs.writeFileSync(this.trackerFile, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error("Erro ao salvar music_tracker.json:", err.message);
    }
  }

  // ─────────────────────────────────────────
  //  Gerenciamento de artistas
  // ─────────────────────────────────────────

  /**
   * Adiciona artista para monitoramento.
   * @param {string} name  - Nome do artista
   * @param {string} [genre] - Gênero (opcional, apenas informativo)
   */
  addArtist(name, genre = null) {
    if (this.trackedArtists.find((a) => a.name.toLowerCase() === name.toLowerCase())) {
      console.log(`⚠️  Artista já monitorado: ${name}`);
      return null;
    }

    const artist = {
      id: Date.now().toString(),
      name,
      genre: genre || null,
      addedAt: new Date().toISOString(),
      lastChecked: null,
      active: true,
    };

    this.trackedArtists.push(artist);
    this.save();
    console.log(`✅ Artista adicionado ao monitoramento: ${name}`);
    return artist;
  }

  removeArtist(artistId) {
    const idx = this.trackedArtists.findIndex((a) => a.id === artistId);
    if (idx !== -1) {
      const { name } = this.trackedArtists[idx];
      this.trackedArtists.splice(idx, 1);
      this.save();
      console.log(`🗑️  Artista removido: ${name}`);
      return true;
    }
    return false;
  }

  listArtists() {
    return this.trackedArtists;
  }

  // ─────────────────────────────────────────
  //  Feeds RSS
  // ─────────────────────────────────────────

  /**
   * Constrói a URL final do feed, incluindo credenciais e queryParams se configurados.
   * @param {object} feed
   * @returns {string}
   */
  buildFeedUrl(feed) {
    let baseUrl = feed.url;

    // Injetar autenticação no estilo https://user:pass@host/path (compatível com TMB)
    if (feed.username && feed.password) {
      const parsed = new URL(baseUrl);
      parsed.username = feed.username;
      parsed.password = feed.password;
      baseUrl = parsed.toString();
    }

    // Adicionar queryParams extras (ex: { tag: 'jungle', artist: '4hero' })
    if (feed.queryParams && Object.keys(feed.queryParams).length > 0) {
      const url = new URL(baseUrl);
      for (const [key, value] of Object.entries(feed.queryParams)) {
        if (value !== null && value !== undefined && value !== "") {
          url.searchParams.set(key, value);
        }
      }
      baseUrl = url.toString();
    }

    return baseUrl;
  }

  /**
   * Busca e retorna todos os itens novos de todos os feeds habilitados.
   */
  async fetchAllFeeds() {
    const enabledFeeds = this.feeds.filter((f) => f.enabled);
    if (enabledFeeds.length === 0) {
      console.log("⚠️  Nenhum feed de música habilitado em config.json");
      return [];
    }

    const allItems = [];

    for (const feed of enabledFeeds) {
      try {
        console.log(`📡 Buscando feed: ${feed.name}`);
        const url = this.buildFeedUrl(feed);
        const parsed = await this.parser.parseURL(url);

        for (const item of parsed.items || []) {
          const uid = item.guid || item.link || item.title;
          if (uid && !this.seenItems.has(uid)) {
            this.seenItems.add(uid);
            allItems.push({
              feedName: feed.name,
              title: item.title || "",
              link: item.link || "",
              guid: uid,
              pubDate: item.pubDate || null,
              enclosure: item.enclosure || null,
              magnetLink: this.extractMagnet(item),
            });
          }
        }

        console.log(`   └─ ${parsed.items?.length || 0} itens lidos`);
      } catch (err) {
        console.warn(`   ⚠️  Erro ao acessar ${feed.name}: ${err.message}`);
      }
    }

    return allItems;
  }

  /**
   * Tenta extrair magnet link de um item RSS
   */
  extractMagnet(item) {
    // Alguns feeds colocam o magnet no enclosure ou em campos customizados
    if (item.enclosure?.url?.startsWith("magnet:")) return item.enclosure.url;
    if (item.link?.startsWith("magnet:")) return item.link;

    // Procurar em campos torrent:magnetURI (ex: Pirate Bay)
    const raw = JSON.stringify(item);
    const match = raw.match(/magnet:[^"\\]*/);
    return match ? match[0] : null;
  }

  // ─────────────────────────────────────────
  //  Verificação de novos lançamentos
  // ─────────────────────────────────────────

  /**
   * Verifica os feeds e retorna itens que correspondem aos artistas monitorados.
   */
  async checkForNewReleases() {
    console.log("\n🎵 Verificando feeds de música...\n");

    const items = await this.fetchAllFeeds();
    const newReleases = [];

    const activeArtists = this.trackedArtists.filter((a) => a.active);

    for (const item of items) {
      const titleLower = item.title.toLowerCase();

      for (const artist of activeArtists) {
        const artistLower = artist.name.toLowerCase();

        if (titleLower.includes(artistLower)) {
          console.log(`🆕 [${item.feedName}] ${item.title}`);
          newReleases.push({ artist, item });
          break;
        }
      }

      // Marcar como visto independentemente de artista
      this.seenItems.add(item.guid);
    }

    // Atualizar lastChecked de todos os artistas ativos
    for (const artist of activeArtists) {
      artist.lastChecked = new Date().toISOString();
    }

    this.save();

    if (newReleases.length === 0) {
      console.log("✅ Nenhum lançamento novo encontrado\n");
    } else {
      console.log(`\n🎉 ${newReleases.length} novo(s) lançamento(s) encontrado(s)!\n`);
    }

    return newReleases;
  }

  /**
   * Busca nos feeds RSS por artista + álbum (consulta ativa, não monitoramento).
   * Retorna resultados no formato compatível com torrentSearch para exibição unificada.
   * @param {string} artist
   * @param {string|null} album
   */
  async searchInFeeds(artist, album = null) {
    const items = await this.fetchAllFeeds();

    const artistLower = artist.toLowerCase();
    const albumLower = album ? album.toLowerCase() : null;

    const matches = items.filter((item) => {
      const t = item.title.toLowerCase();
      const hasArtist = t.includes(artistLower);
      const hasAlbum = albumLower ? t.includes(albumLower) : true;
      return hasArtist && hasAlbum;
    });

    // Normalizar para o formato de torrentSearch
    return matches.map((item) => ({
      title: item.title,
      seeds: 0,
      size: "Desconhecido",
      score: 50, // neutro
      magnetLink: item.magnetLink,
      link: item.link,
      provider: item.feedName,
      _fromRSS: true,
    }));
  }

  /**
   * Lista os últimos N itens de todos os feeds (sem filtro de artista).
   */
  async browseFeeds(limit = 20) {
    const items = await this.fetchAllFeeds();
    return items.slice(0, limit);
  }

  // ─────────────────────────────────────────
  //  Agendamento
  // ─────────────────────────────────────────

  startScheduler(onNewRelease) {
    if (this.cronJob) {
      console.log("⚠️  Agendamento de música já está ativo");
      return;
    }

    const schedule = this.config.music?.checkInterval || "0 */12 * * *";
    console.log(`⏰ Agendamento de música iniciado: ${schedule}`);

    this.cronJob = cron.schedule(schedule, async () => {
      console.log("\n⏰ Verificação agendada de feeds de música...");
      const releases = await this.checkForNewReleases();

      if (releases.length > 0 && onNewRelease) {
        for (const { artist, item } of releases) {
          await onNewRelease(artist, item);
        }
      }
    });
  }

  stopScheduler() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log("⏹️  Agendamento de música parado");
    }
  }

  // ─────────────────────────────────────────
  //  Helpers
  // ─────────────────────────────────────────

  listFeeds() {
    return this.feeds;
  }

  enableFeed(name) {
    const feed = this.feeds.find((f) => f.name === name);
    if (feed) {
      feed.enabled = true;
      return true;
    }
    return false;
  }

  disableFeed(name) {
    const feed = this.feeds.find((f) => f.name === name);
    if (feed) {
      feed.enabled = false;
      return true;
    }
    return false;
  }
}

export default MusicFeedTracker;
