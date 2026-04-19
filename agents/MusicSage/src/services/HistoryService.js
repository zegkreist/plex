/**
 * HistoryService — lê dados de reprodução da biblioteca Plex
 *
 * Usa o endpoint correto: GET /library/sections/{id}/all?sort=viewCount:desc
 * O endpoint /status/sessions/history/all NÃO é confiável — Plex não armazena
 * histórico de sessão por padrão, retornando sempre vazio.
 */
export class HistoryService {
  /**
   * @param {{ axios: object, plexUrl: string, plexToken: string }} config
   */
  constructor({ axios, plexUrl, plexToken } = {}) {
    this.axios = axios;
    this.plexUrl = plexUrl || process.env.PLEX_URL || "http://localhost:32400";
    this.plexToken = plexToken || process.env.PLEX_TOKEN || "";
    this._musicKey = null; // seção da biblioteca de música (auto-detectada)
  }

  get _headers() {
    return {
      "X-Plex-Token": this.plexToken,
      Accept: "application/json",
    };
  }

  /** Encontra e cacheia o key da seção de música (type=artist). */
  async _findMusicSection() {
    if (this._musicKey) return;
    const res = await this.axios.get(`${this.plexUrl}/library/sections`, { headers: this._headers });
    const dirs = res.data?.MediaContainer?.Directory || [];
    const music = dirs.find((d) => d.type === "artist");
    if (!music) throw new Error("Nenhuma biblioteca de música encontrada no Plex");
    this._musicKey = music.key;
  }

  /**
   * @deprecated Use getFavoriteArtists() ou getFavoriteTracks() diretamente.
   * Mantido para compatibilidade com testes existentes.
   */
  async getRecentlyPlayed(limit = 50) {
    try {
      await this._findMusicSection();
      const res = await this.axios.get(
        `${this.plexUrl}/library/sections/${this._musicKey}/all`,
        {
          headers: this._headers,
          params: { type: 10, sort: "lastViewedAt:desc", limit },
        }
      );
      const items = res.data?.MediaContainer?.Metadata || [];
      return items.map((item) => ({
        ratingKey: item.ratingKey,
        title:    item.title,
        artist:   item.grandparentTitle,
        album:    item.parentTitle,
        playedAt: item.lastViewedAt,
        playCount: item.viewCount || 0,
      }));
    } catch (err) {
      console.warn("[HistoryService] Erro ao obter histórico:", err.message);
      return [];
    }
  }

  /**
   * Retorna todas as faixas com qualquer play, ordenadas por lastViewedAt desc.
   * Inclui ratingKey para cross-ref com analysisCache.
   * @param {number} limit
   * @returns {Promise<Array<{ratingKey,title,artist,album,playedAt,playCount,duration}>>}
   */
  async getRecentlyPlayedFull(limit = 500) {
    try {
      await this._findMusicSection();
      const res = await this.axios.get(
        `${this.plexUrl}/library/sections/${this._musicKey}/all`,
        {
          headers: this._headers,
          params: { type: 10, sort: "lastViewedAt:desc", limit },
        }
      );
      const items = res.data?.MediaContainer?.Metadata || [];
      return items
        .filter((item) => (item.viewCount || 0) > 0)
        .map((item) => ({
          ratingKey: item.ratingKey,
          title:     item.title,
          artist:    item.grandparentTitle,
          album:     item.parentTitle,
          playedAt:  item.lastViewedAt,   // Unix timestamp (seconds)
          playCount: item.viewCount || 0,
          duration:  item.duration || 0,  // milliseconds
        }));
    } catch (err) {
      console.warn("[HistoryService] Erro ao obter histórico completo:", err.message);
      return [];
    }
  }

  /**
   * Retorna faixas com lastViewedAt no intervalo dado (timestamps em segundos).
   * Útil para calcular mood de um período específico.
   * @param {number} fromTs  — Unix timestamp início (segundos)
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async getPlayedSince(fromTs, limit = 500) {
    const all = await this.getRecentlyPlayedFull(limit);
    return all.filter((t) => t.playedAt >= fromTs);
  }

  /**
   * Retorna artistas favoritos ordenados por viewCount (plays reais do Plex).
   * @param {number} limit — máximo de artistas (padrão 20)
   * @returns {Promise<Array<{artist, playCount}>>}
   */
  async getFavoriteArtists(limit = 20) {
    try {
      await this._findMusicSection();
      const res = await this.axios.get(
        `${this.plexUrl}/library/sections/${this._musicKey}/all`,
        {
          headers: this._headers,
          params: { type: 8, sort: "viewCount:desc", limit },
        }
      );
      const items = res.data?.MediaContainer?.Metadata || [];
      return items
        .filter((a) => (a.viewCount || 0) > 0)
        .map((a) => ({ artist: a.title, playCount: a.viewCount || 0 }));
    } catch (err) {
      console.warn("[HistoryService] Erro ao calcular favoritos:", err.message);
      return [];
    }
  }

  /**
   * Retorna faixas mais ouvidas ordenadas por viewCount.
   * @param {number} limit — máximo de faixas (padrão 20)
   * @returns {Promise<Array<{title, artist, album, playCount}>>}
   */
  async getFavoriteTracks(limit = 20) {
    try {
      await this._findMusicSection();
      const res = await this.axios.get(
        `${this.plexUrl}/library/sections/${this._musicKey}/all`,
        {
          headers: this._headers,
          params: { type: 10, sort: "viewCount:desc", limit },
        }
      );
      const items = res.data?.MediaContainer?.Metadata || [];
      return items
        .filter((t) => (t.viewCount || 0) > 0)
        .map((t) => ({
          title:     t.title,
          artist:    t.grandparentTitle,
          album:     t.parentTitle,
          playCount: t.viewCount || 0,
        }));
    } catch (err) {
      console.warn("[HistoryService] Erro ao calcular faixas favoritas:", err.message);
      return [];
    }
  }
}
