/**
 * LastFmService — wrapper para a API Last.fm
 *
 * Endpoints utilizados:
 *   artist.getSimilar  → artistas semelhantes a um artista dado
 *   artist.getInfo     → informações e tags de um artista
 *
 * Chave API: variável de ambiente LASTFM_API_KEY (ou null → modo graceful)
 */
export class LastFmService {
  /**
   * @param {{ axios: object, apiKey?: string }} config
   */
  constructor({ axios, apiKey } = {}) {
    this.axios = axios;
    this.apiKey = apiKey || process.env.LASTFM_API_KEY || null;
    this._base = "https://ws.audioscrobbler.com/2.0/";
  }

  get _available() {
    return !!this.apiKey;
  }

  /**
   * Retorna artistas semelhantes ao artista informado.
   * @param {string} artist
   * @param {number} limit  — número máximo de resultados (padrão 20)
   * @returns {Promise<Array<{artist, similarity, url}>>}
   */
  async getSimilarArtists(artist, limit = 20) {
    if (!this._available) return [];
    try {
      const res = await this.axios.get(this._base, {
        params: {
          method: "artist.getSimilar",
          artist,
          limit,
          autocorrect: 1,
          api_key: this.apiKey,
          format: "json",
        },
        timeout: 8000,
      });
      const items = res.data?.similarartists?.artist || [];
      return items.map((a) => ({
        artist:     a.name,
        similarity: parseFloat(a.match) || 0,
        url:        a.url,
      }));
    } catch (err) {
      // Last.fm indisponível não deve quebrar o fluxo
      return [];
    }
  }

  /**
   * Verifica se um artista existe na base Last.fm.
   * Usa artist.getInfo sem autocorrect para não aceitar variações inventadas.
   * Erro 6 = "Artist not found" — retorna false. Fail-open: se Last.fm estiver fora retorna true.
   * @param {string} artistName
   * @returns {Promise<boolean>}
   */
  async verifyArtistExists(artistName) {
    if (!this._available) return true;
    try {
      const res = await this.axios.get(this._base, {
        params: {
          method:      "artist.getInfo",
          artist:      artistName,
          autocorrect: 0,
          api_key:     this.apiKey,
          format:      "json",
        },
        timeout: 5000,
      });
      return !res.data?.error; // error 6 = Artist not found
    } catch {
      return true; // Last.fm fora → não descarta o artista
    }
  }

  /**
   * Retorna tags (gêneros/descritores) de um artista.
   * @param {string} artist
   * @param {number} limit
   * @returns {Promise<string[]>}
   */
  async getArtistTags(artist, limit = 10) {
    if (!this._available) return [];
    try {
      const res = await this.axios.get(this._base, {
        params: {
          method: "artist.getTopTags",
          artist,
          autocorrect: 1,
          api_key: this.apiKey,
          format: "json",
        },
        timeout: 8000,
      });
      const tags = res.data?.toptags?.tag || [];
      return tags.slice(0, limit).map((t) => t.name);
    } catch {
      return [];
    }
  }

  /**
   * Retorna tags específicas de uma faixa (mais precisas que as do artista).
   * @param {string} artist
   * @param {string} track
   * @param {number} limit
   * @returns {Promise<string[]>}
   */
  async getTrackTags(artist, track, limit = 10) {
    if (!this._available) return [];
    try {
      const res = await this.axios.get(this._base, {
        params: {
          method:  "track.getTopTags",
          artist,
          track,
          autocorrect: 1,
          api_key: this.apiKey,
          format:  "json",
        },
        timeout: 8000,
      });
      const tags = res.data?.toptags?.tag || [];
      return tags.slice(0, limit).map((t) => t.name);
    } catch {
      return [];
    }
  }
}
