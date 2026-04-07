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
   * Retorna tags (gêneros) de um artista.
   * @param {string} artist
   * @returns {Promise<string[]>}
   */
  async getArtistTags(artist) {
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
      return tags.slice(0, 5).map((t) => t.name);
    } catch {
      return [];
    }
  }
}
