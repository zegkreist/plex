import { jest } from "@jest/globals";
import { HistoryService } from "../../src/services/HistoryService.js";

function makeAxios(overrides = {}) {
  return { get: jest.fn(), post: jest.fn(), ...overrides };
}

// Mock para /library/sections — retorna seção de música com key=1
const PLEX_SECTIONS_RESPONSE = {
  data: {
    MediaContainer: {
      Directory: [
        { key: "1", type: "artist", title: "Musicas" },
        { key: "2", type: "show",   title: "Series"  },
        { key: "3", type: "movie",  title: "Movies"  },
      ],
    },
  },
};

// Mock para /library/sections/1/all?type=8 (artistas)
const PLEX_ARTISTS_RESPONSE = {
  data: {
    MediaContainer: {
      Metadata: [
        { title: "Pink Floyd",  viewCount: 42, type: "artist" },
        { title: "Radiohead",   viewCount: 30, type: "artist" },
        { title: "Miles Davis", viewCount: 15, type: "artist" },
      ],
    },
  },
};

// Mock para /library/sections/1/all?type=10 (faixas)
const PLEX_TRACKS_RESPONSE = {
  data: {
    MediaContainer: {
      Metadata: [
        {
          title: "Money",
          grandparentTitle: "Pink Floyd",
          parentTitle: "The Dark Side of the Moon",
          viewCount: 10,
          lastViewedAt: 1743000000,
        },
        {
          title: "Karma Police",
          grandparentTitle: "Radiohead",
          parentTitle: "OK Computer",
          viewCount: 8,
          lastViewedAt: 1742900000,
        },
        {
          title: "Brain Damage",
          grandparentTitle: "Pink Floyd",
          parentTitle: "The Dark Side of the Moon",
          viewCount: 7,
          lastViewedAt: 1742800000,
        },
      ],
    },
  },
};

describe("HistoryService", () => {
  let axios;
  let service;

  beforeEach(() => {
    axios = makeAxios();
    service = new HistoryService({
      axios,
      plexUrl: "http://localhost:32400",
      plexToken: "test-token",
    });
  });

  // ── getRecentlyPlayed() ───────────────────────────────────────────────────

  describe("getRecentlyPlayed()", () => {
    it("retorna lista de faixas com campos corretos", async () => {
      axios.get
        .mockResolvedValueOnce(PLEX_SECTIONS_RESPONSE)
        .mockResolvedValueOnce(PLEX_TRACKS_RESPONSE);

      const tracks = await service.getRecentlyPlayed();

      expect(tracks).toHaveLength(3);
      expect(tracks[0]).toMatchObject({
        title:  "Money",
        artist: "Pink Floyd",
        album:  "The Dark Side of the Moon",
      });
      expect(tracks[0]).toHaveProperty("playedAt");
      expect(tracks[0]).toHaveProperty("playCount");
    });

    it("respeita o parâmetro limit", async () => {
      axios.get
        .mockResolvedValueOnce(PLEX_SECTIONS_RESPONSE)
        .mockResolvedValueOnce(PLEX_TRACKS_RESPONSE);

      await service.getRecentlyPlayed(3);

      const callArgs = axios.get.mock.calls[1]; // [0] é sections
      expect(callArgs[1].params.limit).toBe(3);
    });

    it("usa limit padrão de 50 quando não informado", async () => {
      axios.get
        .mockResolvedValueOnce(PLEX_SECTIONS_RESPONSE)
        .mockResolvedValueOnce(PLEX_TRACKS_RESPONSE);

      await service.getRecentlyPlayed();

      const callArgs = axios.get.mock.calls[1];
      expect(callArgs[1].params.limit).toBe(50);
    });

    it("retorna array vazio quando Plex não responde", async () => {
      axios.get.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      const tracks = await service.getRecentlyPlayed();

      expect(tracks).toEqual([]);
    });

    it("retorna array vazio quando não há itens", async () => {
      axios.get
        .mockResolvedValueOnce(PLEX_SECTIONS_RESPONSE)
        .mockResolvedValueOnce({ data: { MediaContainer: {} } });

      const tracks = await service.getRecentlyPlayed();

      expect(tracks).toEqual([]);
    });
  });

  // ── getFavoriteArtists() ──────────────────────────────────────────────────

  describe("getFavoriteArtists()", () => {
    it("retorna artistas ordenados por viewCount do Plex", async () => {
      axios.get
        .mockResolvedValueOnce(PLEX_SECTIONS_RESPONSE)
        .mockResolvedValueOnce(PLEX_ARTISTS_RESPONSE);

      const artists = await service.getFavoriteArtists();

      expect(artists[0].artist).toBe("Pink Floyd");
      expect(artists[0].playCount).toBe(42);
      expect(artists[1].artist).toBe("Radiohead");
    });

    it("cada entrada contém artist e playCount", async () => {
      axios.get
        .mockResolvedValueOnce(PLEX_SECTIONS_RESPONSE)
        .mockResolvedValueOnce(PLEX_ARTISTS_RESPONSE);

      const artists = await service.getFavoriteArtists();

      expect(artists[0]).toHaveProperty("artist");
      expect(artists[0]).toHaveProperty("playCount");
    });

    it("passa limit correto para o Plex", async () => {
      axios.get
        .mockResolvedValueOnce(PLEX_SECTIONS_RESPONSE)
        .mockResolvedValueOnce(PLEX_ARTISTS_RESPONSE);

      await service.getFavoriteArtists(2);

      const callArgs = axios.get.mock.calls[1];
      expect(callArgs[1].params.limit).toBe(2);
    });

    it("retorna array vazio quando Plex está indisponível", async () => {
      axios.get.mockRejectedValueOnce(new Error("timeout"));

      const artists = await service.getFavoriteArtists();

      expect(artists).toEqual([]);
    });

    it("filtra artistas com viewCount zero", async () => {
      axios.get
        .mockResolvedValueOnce(PLEX_SECTIONS_RESPONSE)
        .mockResolvedValueOnce({
          data: {
            MediaContainer: {
              Metadata: [
                { title: "Artist A", viewCount: 5 },
                { title: "Artist B", viewCount: 0 },
              ],
            },
          },
        });

      const artists = await service.getFavoriteArtists();

      expect(artists).toHaveLength(1);
      expect(artists[0].artist).toBe("Artist A");
    });
  });

  // ── getFavoriteTracks() ───────────────────────────────────────────────────

  describe("getFavoriteTracks()", () => {
    it("retorna faixas ordenadas por viewCount", async () => {
      axios.get
        .mockResolvedValueOnce(PLEX_SECTIONS_RESPONSE)
        .mockResolvedValueOnce(PLEX_TRACKS_RESPONSE);

      const tracks = await service.getFavoriteTracks();

      expect(tracks[0]).toMatchObject({
        title:     "Money",
        artist:    "Pink Floyd",
        album:     "The Dark Side of the Moon",
        playCount: 10,
      });
    });

    it("passa limit correto para o Plex", async () => {
      axios.get
        .mockResolvedValueOnce(PLEX_SECTIONS_RESPONSE)
        .mockResolvedValueOnce(PLEX_TRACKS_RESPONSE);

      await service.getFavoriteTracks(5);

      const callArgs = axios.get.mock.calls[1];
      expect(callArgs[1].params.limit).toBe(5);
    });

    it("retorna array vazio quando Plex está indisponível", async () => {
      axios.get.mockRejectedValueOnce(new Error("timeout"));

      const tracks = await service.getFavoriteTracks();

      expect(tracks).toEqual([]);
    });
  });

  // ── Autenticação / URL ────────────────────────────────────────────────────

  describe("endpoint e autenticação", () => {
    it("consulta /library/sections para detectar seção de música", async () => {
      axios.get
        .mockResolvedValueOnce(PLEX_SECTIONS_RESPONSE)
        .mockResolvedValueOnce(PLEX_ARTISTS_RESPONSE);

      await service.getFavoriteArtists();

      const sectionsUrl = axios.get.mock.calls[0][0];
      expect(sectionsUrl).toContain("/library/sections");
    });

    it("usa /library/sections/{id}/all para buscar artistas", async () => {
      axios.get
        .mockResolvedValueOnce(PLEX_SECTIONS_RESPONSE)
        .mockResolvedValueOnce(PLEX_ARTISTS_RESPONSE);

      await service.getFavoriteArtists();

      const artistsUrl = axios.get.mock.calls[1][0];
      expect(artistsUrl).toContain("/library/sections/1/all");
    });

    it("inclui X-Plex-Token no header", async () => {
      axios.get
        .mockResolvedValueOnce(PLEX_SECTIONS_RESPONSE)
        .mockResolvedValueOnce(PLEX_ARTISTS_RESPONSE);

      await service.getFavoriteArtists();

      const headers = axios.get.mock.calls[1][1].headers;
      expect(headers["X-Plex-Token"]).toBe("test-token");
    });

    it("cacheia o _musicKey — sections chamado apenas uma vez por instância", async () => {
      axios.get
        .mockResolvedValueOnce(PLEX_SECTIONS_RESPONSE)
        .mockResolvedValueOnce(PLEX_ARTISTS_RESPONSE)
        .mockResolvedValueOnce(PLEX_ARTISTS_RESPONSE);

      await service.getFavoriteArtists();
      await service.getFavoriteArtists(); // segunda chamada — não deve re-chamar sections

      const sectionCalls = axios.get.mock.calls.filter((c) => c[0].includes("/library/sections") && !c[0].includes("/all"));
      expect(sectionCalls).toHaveLength(1);
    });
  });
});
